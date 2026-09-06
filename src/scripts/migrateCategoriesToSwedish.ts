import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { LEGACY_CATEGORY_VALUES } from '../utils/categoryMigration';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/karate-attendance';
const APPLY_MIGRATION = process.argv.includes('--apply');
const CATEGORY_MAPPINGS = Object.entries(LEGACY_CATEGORY_VALUES);

type MigrationResult = {
  collection: string;
  matched: number;
  modified: number;
};

function getCollection(name: string) {
  const database = mongoose.connection.db;
  if (!database) {
    throw new Error('MongoDB connection is unavailable');
  }

  return database.collection(name);
}

async function countArrayCategoryValues(collectionName: string): Promise<number> {
  const collection = getCollection(collectionName);
  const counts = await Promise.all(
    CATEGORY_MAPPINGS.map(([legacyValue]) => collection.countDocuments({ categories: legacyValue }))
  );

  return counts.reduce((total, count) => total + count, 0);
}

async function countSingleCategoryValues(collectionName: string): Promise<number> {
  const collection = getCollection(collectionName);
  const counts = await Promise.all(
    CATEGORY_MAPPINGS.map(([legacyValue]) => collection.countDocuments({ category: legacyValue }))
  );

  return counts.reduce((total, count) => total + count, 0);
}

async function migrateArrayCategoryValues(collectionName: string): Promise<MigrationResult> {
  const collection = getCollection(collectionName);
  const results = await Promise.all(
    CATEGORY_MAPPINGS.map(async ([legacyValue, swedishValue]) => {
      return collection.updateMany(
        { categories: legacyValue },
        { $set: { 'categories.$[category]': swedishValue } },
        { arrayFilters: [{ category: legacyValue }] }
      );
    })
  );

  return {
    collection: collectionName,
    matched: results.reduce((total, result) => total + result.matchedCount, 0),
    modified: results.reduce((total, result) => total + result.modifiedCount, 0),
  };
}

async function migrateSingleCategoryValues(collectionName: string): Promise<MigrationResult> {
  const collection = getCollection(collectionName);
  const results = await Promise.all(
    CATEGORY_MAPPINGS.map(([legacyValue, swedishValue]) =>
      collection.updateMany({ category: legacyValue }, { $set: { category: swedishValue } })
    )
  );

  return {
    collection: collectionName,
    matched: results.reduce((total, result) => total + result.matchedCount, 0),
    modified: results.reduce((total, result) => total + result.modifiedCount, 0),
  };
}

async function main(): Promise<void> {
  const unsupportedArguments = process.argv.slice(2).filter(
    (argument) => argument !== '--' && argument !== '--apply'
  );
  if (unsupportedArguments.length > 0) {
    throw new Error(`Unsupported arguments: ${unsupportedArguments.join(', ')}`);
  }

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  try {
    if (!APPLY_MIGRATION) {
      const [students, classes, attendance] = await Promise.all([
        countArrayCategoryValues('students'),
        countArrayCategoryValues('classes'),
        countSingleCategoryValues('attendances'),
      ]);
      console.log(`Dry run: ${students} member category values, ${classes} class category values, and ${attendance} attendance category values need migration.`);
      console.log('Run "pnpm run migrate:categories-sv -- --apply" to apply the migration.');
      return;
    }

    const results = await Promise.all([
      migrateArrayCategoryValues('students'),
      migrateArrayCategoryValues('classes'),
      migrateSingleCategoryValues('attendances'),
    ]);

    for (const result of results) {
      console.log(`${result.collection}: matched ${result.matched}, updated ${result.modified}.`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Category migration failed:', error);
  process.exitCode = 1;
});
