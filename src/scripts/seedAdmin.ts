// src/scripts/seedAdmin.ts - Create initial admin user
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { UserModel } from '../models/User';
import { UserRoleEnum, UserStatusEnum } from '../types/interfaces';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/karate-attendance';
const SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@karateattendance.com';
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
const PRINT_SEED_ADMIN_PASSWORD =
  process.env.PRINT_SEED_ADMIN_PASSWORD === 'true' || process.argv.includes('--print-password');

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await UserModel.findOne({ role: UserRoleEnum.ADMIN });

    if (existingAdmin) {
      console.log('⚠️  Admin user already exists:', existingAdmin.email);
      console.log('Skipping admin creation.');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Create admin user
    const adminData = {
      email: SEED_ADMIN_EMAIL,
      password: SEED_ADMIN_PASSWORD, // MUST be changed on first login
      name: 'System Administrator',
      role: UserRoleEnum.ADMIN,
      status: UserStatusEnum.ACTIVE,
      created_by: 'system'
    };

    const admin = new UserModel(adminData);
    await admin.save();

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', adminData.email);
    if (PRINT_SEED_ADMIN_PASSWORD) {
      console.log('🔑 Password:', adminData.password);
    } else {
      console.log('🔑 Password: (redacted)');
      console.log('To print password, run with PRINT_SEED_ADMIN_PASSWORD=true or pass --print-password');
    }
    console.log('⚠️  IMPORTANT: Change this password immediately after first login!');

    await mongoose.connection.close();
    console.log('💤 Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedAdmin();
