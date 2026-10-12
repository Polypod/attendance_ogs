import { Request, Response } from 'express';
import { KioskAccessRequestService } from '../services/KioskAccessRequestService';
import { KioskManagementError } from '../services/KioskManagementService';

const service = new KioskAccessRequestService();

function sendError(res: Response, error: unknown): void {
  if (error instanceof KioskManagementError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }
  res.status(500).json({ success: false, message: 'Kiosk access request failed' });
}

export const kioskAccessRequestController = {
  requestAccess: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await service.requestAccess(req.body.name, req.ip || '', req.get('user-agent') || '');
      res.status(201).json({ success: true, data });
    } catch (error: unknown) {
      sendError(res, error);
    }
  },
  getStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await service.getStatus(req.params.id, req.get('x-kiosk-request-token') || '');
      res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      sendError(res, error);
    }
  },
  listPending: async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await service.listPending();
      res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      sendError(res, error);
    }
  },
  approve: async (req: Request, res: Response): Promise<void> => {
    if (!req.user?._id) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    try {
      await service.approve(req.params.id, req.user._id);
      res.status(200).json({ success: true });
    } catch (error: unknown) {
      sendError(res, error);
    }
  },
};
