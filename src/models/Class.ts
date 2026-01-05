// src/models/Class.ts - Class Mongoose model
import { Schema, model, Document, Types } from 'mongoose';
import { Class, StudentCategory } from '../types/interfaces';

interface IClassDocument extends Omit<Class, '_id'>, Document {
  _id: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const classSchema = new Schema<IClassDocument>({
  name: { 
    type: String, 
    required: [true, 'Class name is required'],
    trim: true,
    minlength: [3, 'Class name must be at least 3 characters long']
  },
  description: { 
    type: String, 
    required: [true, 'Class description is required'],
    trim: true
  },
  categories: [{
    type: String,
    enum: {
      values: ['kids', 'youth', 'adult', 'advanced'],
      message: 'Invalid class category. Must be one of: kids, youth, adult, advanced'
    },
    required: [true, 'At least one category is required'],
    validate: {
      validator: (value: StudentCategory[]) => value.length > 0,
      message: 'At least one category is required'
    }
  }],
  instructor: { 
    type: String, 
    required: [true, 'Instructor name is required'],
    trim: true
  },
  max_capacity: { 
    type: Number, 
    required: [true, 'Maximum capacity is required'],
    min: [1, 'Maximum capacity must be at least 1'],
    max: [100, 'Maximum capacity cannot exceed 100']
  },
  duration_minutes: { 
    type: Number, 
    required: [true, 'Class duration is required'],
    min: [15, 'Class duration must be at least 15 minutes'],
    max: [240, 'Class duration cannot exceed 240 minutes (4 hours)']
  }
}, {
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  },
  versionKey: false
});

// Add indexes for frequently queried fields
classSchema.index({ name: 1 });
classSchema.index({ categories: 1 });
classSchema.index({ instructor: 1 });

export const ClassModel = model<IClassDocument>('Class', classSchema);