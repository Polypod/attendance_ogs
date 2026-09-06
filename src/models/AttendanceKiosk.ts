import { Document, model, Schema, Types } from 'mongoose';

export interface IAttendanceKioskDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  token_hash: string;
  active: boolean;
  created_by: string;
  last_used_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const attendanceKioskSchema = new Schema<IAttendanceKioskDocument>({
  name: {
    type: String,
    required: [true, 'Kiosk name is required'],
    trim: true,
    unique: true,
    minlength: [2, 'Kiosk name must be at least 2 characters long'],
    maxlength: [100, 'Kiosk name cannot exceed 100 characters'],
  },
  token_hash: {
    type: String,
    required: true,
    select: false,
  },
  active: {
    type: Boolean,
    default: true,
  },
  created_by: {
    type: String,
    required: true,
  },
  last_used_at: {
    type: Date,
  },
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  versionKey: false,
});

attendanceKioskSchema.index({ active: 1 });

export const AttendanceKioskModel = model<IAttendanceKioskDocument>('AttendanceKiosk', attendanceKioskSchema);
