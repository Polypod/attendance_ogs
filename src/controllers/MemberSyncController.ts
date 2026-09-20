// src/controllers/MemberSyncController.ts - Member sync endpoints
import { Request, Response } from 'express';
import { MemberSyncService } from '../services/MemberSyncService';
import { MemberSyncRunModel } from '../models/MemberSyncRun';

export class MemberSyncController {
  constructor(private readonly memberSyncService = new MemberSyncService()) {}

  /** Dry run: reports what would change without writing anything. */
  previewSync = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.memberSyncService.preview();
      res.status(200).json({
        success: true,
        message: 'Member sync preview generated successfully',
        data: result,
      });
    } catch (error) {
      res.status(502).json({
        success: false,
        requestId: req.requestId,
        message: 'Error generating member sync preview',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  runSync = async (req: Request, res: Response): Promise<void> => {
    try {
      const triggeredBy = req.user?.email ?? 'manual';
      const result = await this.memberSyncService.apply(triggeredBy);
      res.status(200).json({
        success: true,
        message: 'Member sync applied successfully',
        data: result,
      });
    } catch (error) {
      res.status(502).json({
        success: false,
        requestId: req.requestId,
        message: 'Error applying member sync',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  getSyncStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const runs = await MemberSyncRunModel.find({})
        .sort({ started_at: -1 })
        .limit(10)
        .lean();

      res.status(200).json({
        success: true,
        data: {
          configured: Boolean(process.env.OGS_SYNC_URL && process.env.OGS_SYNC_API_KEY),
          lastRun: runs[0] ?? null,
          recentRuns: runs,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        requestId: req.requestId,
        message: 'Error fetching member sync status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

export const memberSyncController = new MemberSyncController();
