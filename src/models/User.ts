// src/models/User.ts - User Mongoose model with authentication
import { Schema, model, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserRoleEnum, UserStatusEnum } from '../types/interfaces';

interface IUserDocument extends Omit<User, '_id'>, Document {
  _id: Types.ObjectId;
  password: string;
  created_at: Date;
  updated_at: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  changedPasswordAfter(JWTTimestamp: number): boolean;
}

const userSchema = new Schema<IUserDocument>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Exclude password from queries by default
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  role: {
    type: String,
    enum: {
      values: Object.values(UserRoleEnum),
      message: `Role must be one of: ${Object.values(UserRoleEnum).join(', ')}`
    },
    required: [true, 'User role is required']
  },
  status: {
    type: String,
    enum: {
      values: Object.values(UserStatusEnum),
      message: `Status must be one of: ${Object.values(UserStatusEnum).join(', ')}`
    },
    default: UserStatusEnum.ACTIVE
  },
  created_by: {
    type: String,
    required: [true, 'Created by field is required']
  },
  last_login: {
    type: Date
  },
  password_changed_at: {
    type: Date
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  versionKey: false
});



// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash the password with bcrypt (10 rounds)
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);

    // Set password_changed_at if password was modified (but not for new users)
    if (!this.isNew) {
      this.password_changed_at = new Date();
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp: number): boolean {
  if (this.password_changed_at) {
    const changedTimestamp = Math.floor(this.password_changed_at.getTime() / 1000);
    return JWTTimestamp < changedTimestamp;
  }

  // Password was not changed
  return false;
};

export const UserModel = model<IUserDocument>('User', userSchema);
