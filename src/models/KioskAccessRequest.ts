import { Document, model, Schema, Types } from 'mongoose';

export interface IKioskAccessRequestDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  token_hash: string;
  ip_address: string;
  user_agent: string;
  status: 'pending' | 'approved';
  approved_by?: string;
  approved_at?: Date;
  kiosk_id?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const kioskAccessRequestSchema = new Schema<IKioskAccessRequestDocument>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  token_hash: { type: String, required: true, select: false },
  ip_address: { type: String, required: true, maxlength: 100 },
  user_agent: { type: String, required: true, maxlength: 500 },
  status: { type: String, enum: ['pending', 'approved'], default: 'pending', required: true },
  approved_by: String,
  approved_at: Date,
  kiosk_id: { type: Schema.Types.ObjectId, ref: 'AttendanceKiosk' },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  versionKey: false,
});

kioskAccessRequestSchema.index({ status: 1, created_at: 1 });

export const KioskAccessRequestModel = model<IKioskAccessRequestDocument>('KioskAccessRequest', kioskAccessRequestSchema);
