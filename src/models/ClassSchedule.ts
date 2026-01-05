// src/models/ClassSchedule.ts - Class Schedule model
import { Schema, model, Document, Types } from 'mongoose';
import { ClassSchedule, ClassStatus, ClassStatusEnum, DayOfWeekEnum } from '../types/interfaces';

export interface IClassScheduleDocument extends Omit<ClassSchedule, '_id' | 'class_id'>, Document {
  _id: Types.ObjectId;
  class_id: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const classScheduleSchema = new Schema<IClassScheduleDocument>({
  class_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'Class', 
    required: [true, 'Class reference is required']
  },
  date: {
    type: Date,
    required: [true, 'Class date is required'],
    validate: {
      validator: function(value: Date) {
        // Ensure date is not in the past for new documents
        if ((this as any).isNew) {
          return value >= new Date(new Date().setHours(0, 0, 0, 0));
        }
        return true;
      },
      message: 'Class date cannot be in the past'
    }
  },
  start_time: { 
    type: String, 
    required: [true, 'Start time is required'],
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:MM format']
  },
  end_time: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter a valid time in HH:MM format'],
    validate: {
      validator: function(value: string) {
        // Ensure end time is after start time
        const doc = this as any;
        if (doc.start_time && value) {
          const [startHour, startMinute] = doc.start_time.split(':').map(Number);
          const [endHour, endMinute] = value.split(':').map(Number);

          const startDate = new Date();
          startDate.setHours(startHour, startMinute, 0, 0);

          const endDate = new Date();
          endDate.setHours(endHour, endMinute, 0, 0);

          return endDate > startDate;
        }
        return true;
      },
      message: 'End time must be after start time'
    }
  },
  day_of_week: { 
    type: String, 
    required: [true, 'Day of week is required'],
    enum: {
      values: Object.values(DayOfWeekEnum),
      message: `Day of week must be one of: ${Object.values(DayOfWeekEnum).join(', ')}`
    }
  },
  recurring: { 
    type: Boolean, 
    default: false 
  },
  status: {
    type: String,
    enum: {
      values: Object.values(ClassStatusEnum),
      message: `Status must be one of: ${Object.values(ClassStatusEnum).join(', ')}`
    },
    default: ClassStatusEnum.SCHEDULED
  }
}, {
  timestamps: { 
    createdAt: 'created_at', 
    updatedAt: 'updated_at' 
  },
  versionKey: false
});

// Add indexes for frequently queried fields
classScheduleSchema.index({ date: 1 });
classScheduleSchema.index({ class_id: 1 });
classScheduleSchema.index({ status: 1 });
classScheduleSchema.index({ day_of_week: 1 });
classScheduleSchema.index({ start_time: 1 });

// Compound index for date and time range queries
classScheduleSchema.index({ date: 1, start_time: 1 });

// Middleware to validate class existence
classScheduleSchema.pre('save', async function() {
  const ClassModel = model('Class');
  const classExists = await ClassModel.exists({ _id: this.class_id });
  if (!classExists) {
    throw new Error('Referenced class does not exist');
  }
});

export const ClassScheduleModel = model<IClassScheduleDocument>('ClassSchedule', classScheduleSchema);
