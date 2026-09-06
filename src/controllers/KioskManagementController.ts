import { Request, Response } from 'express';
import { KioskManagementError, KioskManagementService } from '../services/KioskManagementService';

function sendKioskManagementError(res: Response, error: unknown): void {
  if (error instanceof KioskManagementError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ success: false, message: 'Kiosk management request failed', error: message });
}

export class KioskManagementController {
  private readonly kioskManagementService = new KioskManagementService();

  listKiosks = async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.kioskManagementService.listKiosks();
      res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      sendKioskManagementError(res, error);
    }
  };

  createKiosk = async (req: Request, res: Response): Promise<void> => {
    if (!req.user?._id) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    try {
      const data = await this.kioskManagementService.createKiosk(req.body.name, req.user._id);
      res.status(201).json({ success: true, data });
    } catch (error: unknown) {
      sendKioskManagementError(res, error);
    }
  };

  rotateAccessKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.kioskManagementService.rotateAccessKey(req.params.id);
      res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      sendKioskManagementError(res, error);
    }
  };

  setKioskStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.kioskManagementService.setKioskStatus(req.params.id, req.body.active);
      res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      sendKioskManagementError(res, error);
    }
  };

  updateKioskName = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.kioskManagementService.updateKioskName(req.params.id, req.body.name);
      res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      sendKioskManagementError(res, error);
    }
  };

  deleteKiosk = async (req: Request, res: Response): Promise<void> => {
    try {
      await this.kioskManagementService.deleteKiosk(req.params.id);
      res.status(200).json({ success: true, message: 'Kiosk deleted successfully' });
    } catch (error: unknown) {
      sendKioskManagementError(res, error);
    }
  };
}

export const kioskManagementController = new KioskManagementController();
