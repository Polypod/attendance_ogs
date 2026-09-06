// src/scripts/seedKiosks.ts - Create initial kiosk devices
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { AttendanceKioskModel } from '../models/AttendanceKiosk';
import { hashKioskAccessKey } from '../services/KioskManagementService';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/karate-attendance';

const KIOSKS_TO_CREATE = [
  { name: 'Reception Desk' },
  { name: 'Training Hall 1' },
  { name: 'Training Hall 2' },
];

const seedKiosks = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing kiosks to recreate with new keys
    const existingCount = await AttendanceKioskModel.countDocuments({});
    if (existingCount > 0) {
      console.log(`🗑️  Deleting ${existingCount} existing kiosks...`);
      await AttendanceKioskModel.deleteMany({});
      console.log('✅ Existing kiosks deleted');
    }

    const createdKiosks = [];

    for (const kioskData of KIOSKS_TO_CREATE) {
      // Generate random access key (same format as KioskManagementService)
      const accessKey = crypto.randomBytes(32).toString('base64url');
      const accessKeyHash = hashKioskAccessKey(accessKey);

      const kiosk = new AttendanceKioskModel({
        name: kioskData.name,
        token_hash: accessKeyHash,
        active: true,
        created_by: 'system',
      });

      await kiosk.save();
      createdKiosks.push({ name: kioskData.name, accessKey, id: kiosk._id });
      console.log(`✅ Created kiosk: ${kioskData.name}`);
    }

    console.log('\n📋 Kiosk Access Keys (Save These Securely!)');
    console.log('==========================================');
    createdKiosks.forEach((kiosk) => {
      console.log(`\n🏢 ${kiosk.name}`);
      console.log(`   ID: ${kiosk.id}`);
      console.log(`   Access Key: ${kiosk.accessKey}`);
    });
    console.log('\n⚠️  Keep these access keys safe! They are needed to activate the kiosk devices.');

    await mongoose.connection.close();
    console.log('\n💤 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding kiosks:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedKiosks();
