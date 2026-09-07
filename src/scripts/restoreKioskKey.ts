// src/scripts/restoreKioskKey.ts - Restore a kiosk with a known access key
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { AttendanceKioskModel } from '../models/AttendanceKiosk';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/karate-attendance';

// The access key from the activation link
const KIOSK_NAME = process.env.RESTORE_KIOSK_NAME || 'Entré-iPad';
const ACCESS_KEY = process.env.RESTORE_ACCESS_KEY;

if (!ACCESS_KEY) {
  console.error('❌ Error: RESTORE_ACCESS_KEY environment variable must be set');
  console.error('   Usage: RESTORE_ACCESS_KEY=<key> RESTORE_KIOSK_NAME=<name> npm run restore:kiosk');
  process.exit(1);
}

function hashKioskAccessKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

const restoreKiosk = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const tokenHash = hashKioskAccessKey(ACCESS_KEY);

    // Check if kiosk already exists
    const existing = await AttendanceKioskModel.findOne({ name: KIOSK_NAME });
    
    if (existing) {
      // Update existing kiosk with new token hash
      console.log(`🔄 Updating existing kiosk: ${KIOSK_NAME}`);
      await AttendanceKioskModel.updateOne(
        { _id: existing._id },
        { token_hash: tokenHash, active: true }
      );
      console.log(`✅ Kiosk "${KIOSK_NAME}" updated with access key`);
    } else {
      // Create new kiosk with this name and key
      console.log(`🆕 Creating new kiosk: ${KIOSK_NAME}`);
      const kiosk = await AttendanceKioskModel.create({
        name: KIOSK_NAME,
        token_hash: tokenHash,
        active: true,
        created_by: 'restore-script',
      });
      console.log(`✅ Kiosk "${KIOSK_NAME}" created with access key`);
      console.log(`   ID: ${kiosk._id}`);
    }

    console.log(`\n✅ Kiosk restoration complete!`);
    console.log(`   Name: ${KIOSK_NAME}`);
    console.log(`   Access Key: ${ACCESS_KEY}`);
    console.log(`   The device should now be able to authenticate.`);

    await mongoose.connection.close();
    console.log('\n💤 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error restoring kiosk:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

restoreKiosk();
