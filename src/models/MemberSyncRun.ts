// src/models/MemberSyncRun.ts - Audit log for member sync runs
import { Schema, model, Document, Types } from 'mongoose';

export interface IMemberSyncRunDocument extends Document {
  _id: Types.ObjectId;
  started_at: Date;
  finished_at?: Date;
  dry_run: boolean;
  succeeded: boolean;
  triggered_by: string;
  source_generated_at?: Date;
  summary: {
    total: number;
    created: number;
    updated: number;
    deactivated: number;
    unchanged: number;
    skipped: number;
    failed: number;
  };
  /** Rows that need a human decision, typically a missing category in OGS. */
  attention: string[];
  /** Named error_messages because Document already declares `errors`. */
  error_messages: string[];
}

const summarySchema = new Schema(
  {
    total: { type: Number, default: 0 },
    created: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    deactivated: { type: Number, default: 0 },
    unchanged: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { _id: false, timestamps: false }
);

const memberSyncRunSchema = new Schema<IMemberSyncRunDocument>(
  {
    started_at: { type: Date, required: true, default: () => new Date() },
    finished_at: { type: Date, required: false },
    dry_run: { type: Boolean, required: true, default: false },
    succeeded: { type: Boolean, required: true, default: false },
    triggered_by: { type: String, required: true, default: 'manual' },
    source_generated_at: { type: Date, required: false },
    summary: { type: summarySchema, required: true, default: () => ({}) },
    attention: { type: [String], default: [] },
    error_messages: { type: [String], default: [] },
  },
  { versionKey: false }
);

// The status endpoint only ever asks for the most recent runs.
memberSyncRunSchema.index({ started_at: -1 });

export const MemberSyncRunModel = model<IMemberSyncRunDocument>(
  'MemberSyncRun',
  memberSyncRunSchema
);
