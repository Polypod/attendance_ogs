// src/models/Attendance.ts - Attendance model
import { Schema, model, Document, Types, Model } from 'mongoose';
import { 
  Attendance, 
  AttendanceStatus, 
  StudentCategory, 
  AttendanceStatusEnum, 
  StudentCategoryEnum 
} from '../types/interfaces';

// Interface for the document (instance methods)
export interface IAttendanceDocument extends Omit<Attendance, '_id' | 'student_id' | 'class_schedule_id'>, Document {
  _id: Types.ObjectId;
  student_id: Types.ObjectId;
  class_schedule_id: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

// Interface for the model (static methods)
export interface IAttendanceModel extends Model<IAttendanceDocument> {
  // Let Mongoose handle the base Model methods
  // No need to redefine methods as they are inherited from Model<T>
}

const attendanceSchema = new Schema<IAttendanceDocument>(
  {
    student_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'Student', 
      required: true 
    },
    class_schedule_id: { 
      type: Schema.Types.ObjectId, 
      ref: 'ClassSchedule', 
      required: true 
    },
    date: { 
      type: Date, 
      required: true 
    },
    status: {
      type: String,
      enum: Object.values(AttendanceStatusEnum),
      required: [true, 'Status is required'],
      validate: {
        validator: (value: string) => Object.values(AttendanceStatusEnum).includes(value as any),
        message: `Status must be one of: ${Object.values(AttendanceStatusEnum).join(', ')}`
      }
    },
    category: {
      type: String,
      enum: Object.values(StudentCategoryEnum),
      required: [true, 'Category is required'],
      validate: {
        validator: (value: string) => Object.values(StudentCategoryEnum).includes(value as any),
        message: `Category must be one of: ${Object.values(StudentCategoryEnum).join(', ')}`
      }
    },
    notes: { 
      type: String,
      default: ''
    },
    recorded_by: { 
      type: String, 
      required: true 
    },
    recorded_at: { 
      type: Date, 
      default: Date.now 
    }
  },
  {
    timestamps: { 
      createdAt: 'created_at', 
      updatedAt: 'updated_at' 
    }
  }
);

// Ensure unique attendance per student per class schedule
attendanceSchema.index(
  { student_id: 1, class_schedule_id: 1 }, 
  { unique: true }
);

// Create and export the model
const Attendance = model<IAttendanceDocument, IAttendanceModel>('Attendance', attendanceSchema);

export { Attendance };