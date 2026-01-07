// src/models/Student.ts - Student Mongoose model
import { Schema, model, Document, Types } from 'mongoose';
import { Student, StudentCategory, StudentStatus, StudentStatusEnum } from '../types/interfaces';
import { ConfigService } from '../services/ConfigService';

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
    required: false
  },
  phone: { 
    type: String, 
    required: false
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
  categories: {
    type: [String],
    required: [true, 'At least one category is required'],
    validate: {
      validator: function(this: any, values: string[]) {
        if (!values || values.length === 0) return false;
        const configService = ConfigService.getInstance();
        return values.every(val => configService.isValidCategory(val));
      },
      message: function() {
        const configService = ConfigService.getInstance();
        const validCategories = configService.getCategoryValues().join(', ');
        return `Invalid student category. Must be one of: ${validCategories}`;
      }
    }
  },

  belt_level: {
    type: String,
    required: [true, 'Belt level is required'],
    validate: {
      validator: function(value: string) {
        const configService = ConfigService.getInstance();
        return configService.isValidBeltLevel(value);
      },
      message: function() {
        const configService = ConfigService.getInstance();
        const validBeltLevels = configService.getBeltLevelValues().join(', ');
        return `Invalid belt level. Must be one of: ${validBeltLevels}`;
      }
    }
  },
  registration_date: { 
    type: Date, 
    default: () => new Date()
  },
  phone: { 
    type: String, 
    required: false
  },
  emergency_contact: { 
    type: emergencyContactSchema, 
    required: false
  },
  status: {
    type: String,
    enum: {
      values: Object.values(StudentStatusEnum),
      message: `Status must be one of: ${Object.values(StudentStatusEnum).join(', ')}`
    },
    default: StudentStatusEnum.ACTIVE
  },
  active: {
    type: Boolean,
    default: true,
    required: false
  }
}, {
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  },
  versionKey: false
});



export const StudentModel = model<IStudentDocument>('Student', studentSchema);