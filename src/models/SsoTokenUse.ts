// src/models/SsoTokenUse.ts - One-time use record for OGS ID tokens
import { Schema, model, Document, Types } from 'mongoose';

export interface ISsoTokenUseDocument extends Document {
  _id: Types.ObjectId;
  token_hash: string;
  expires_at: Date;
}

/**
 * Each OGS ID token may start one attendance session. The hash is kept until
 * the token itself expires, after which MongoDB's TTL monitor removes it.
 */
const ssoTokenUseSchema = new Schema<ISsoTokenUseDocument>(
  {
    token_hash: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },
  },
  { versionKey: false }
);

ssoTokenUseSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const SsoTokenUseModel = model<ISsoTokenUseDocument>('SsoTokenUse', ssoTokenUseSchema);
