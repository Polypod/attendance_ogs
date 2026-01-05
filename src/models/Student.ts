// src/models/Student.ts - Student Mongoose model
import { Schema, model, Document, Types } from 'mongoose';
import { Student, StudentCategory, StudentStatus, StudentStatusEnum } from '../types/interfaces';

interface IStudentDocument extends Omit<Student, '_id'>, Document {
  _id: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

interface IEmergencyContact {
  name: string;
  phone: string;
}

const emergencyContactSchema = new Schema<IEmergencyContact>({
  name: { 
    type: String, 
    required: [true, 'Emergency contact name is required'] 
  },
  phone: { 
    type: String, 
    required: [true, 'Emergency contact phone is required'] 
  }
}, { _id: false, timestamps: false });

const studentSchema = new Schema<IStudentDocument>({
  name: { 
    type: String, 
    required: [true, 'Name is required'] 
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  categories: [{
    type: String,
    enum: {
      values: ['kids', 'youth', 'adult', 'advanced'],
      message: 'Invalid student category. Must be one of: kids, youth, adult, advanced'
    },
    required: [true, 'At least one category is required'],
    validate: {
      validator: (value: StudentCategory[]) => value.length > 0,
      message: 'At least one category is required'
    }
  }],
  belt_level: { 
    type: String, 
    required: [true, 'Belt level is required'] 
  },
  registration_date: { 
    type: Date, 
    default: () => new Date()
  },
  phone: { 
    type: String, 
    required: [true, 'Phone number is required'] 
  },
  emergency_contact: { 
    type: emergencyContactSchema, 
    required: [true, 'Emergency contact information is required'] 
  },
  status: {
    type: String,
    enum: {
      values: Object.values(StudentStatusEnum),
      message: `Status must be one of: ${Object.values(StudentStatusEnum).join(', ')}`
    },
    default: StudentStatusEnum.ACTIVE
  }
}, {
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  },
  versionKey: false
});

// Add index for frequently queried fields
studentSchema.index({ email: 1 }, { unique: true });
studentSchema.index({ status: 1 });
studentSchema.index({ categories: 1 });

export const StudentModel = model<IStudentDocument>('Student', studentSchema);