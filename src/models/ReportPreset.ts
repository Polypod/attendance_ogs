// src/models/ReportPreset.ts - Report preset model (private + shared)
import { Schema, model, Document, Types } from 'mongoose';
import { ReportPresetState } from '../types/interfaces';

export interface IReportPresetDocument extends Document {
  _id: Types.ObjectId;
  owner_user_id: Types.ObjectId;
  name: string;
  shared: boolean;
  schemaVersion: number;
  state: ReportPresetState;
  created_at: Date;
  updated_at: Date;
}

const reportPresetSchema = new Schema<IReportPresetDocument>(
  {
    owner_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner user ID is required'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Preset name is required'],
      trim: true,
      minlength: [1, 'Preset name is required'],
      maxlength: [80, 'Preset name cannot exceed 80 characters']
    },
    shared: {
      type: Boolean,
      default: false,
      index: true
    },
    schemaVersion: {
      type: Number,
      default: 1,
      min: [1, 'schemaVersion must be at least 1']
    },
    state: {
      type: Schema.Types.Mixed,
      required: [true, 'Preset state is required']
    }
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    versionKey: false
  }
);

reportPresetSchema.index({ owner_user_id: 1, shared: 1, updated_at: -1 });

export const ReportPresetModel = model<IReportPresetDocument>('ReportPreset', reportPresetSchema);
