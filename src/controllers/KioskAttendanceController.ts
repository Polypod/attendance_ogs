import { Request, Response } from 'express';
import { KioskAttendanceError, KioskAttendanceService } from '../services/KioskAttendanceService';

function sendKioskError(res: Response, error: unknown): void {
  if (error instanceof KioskAttendanceError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json({ success: false, message: 'Kiosk attendance request failed', error: message });
}

export class KioskAttendanceController {
  private readonly kioskAttendanceService = new KioskAttendanceService();

  getToday = async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.kioskAttendanceService.getTodaySessions();
      res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      sendKioskError(res, error);
    }
  };

  finalizeSession = async (req: Request, res: Response): Promise<void> => {
    if (!req.kiosk) {
      res.status(401).json({ success: false, message: 'Kiosk authentication required' });
      return;
    }

    try {
      const data = await this.kioskAttendanceService.finalizeSession(
        req.params.scheduleId,
        req.body.presentStudentIds,
        { id: req.kiosk._id, name: req.kiosk.name }
      );
      res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      sendKioskError(res, error);
    }
  };
}

export const kioskAttendanceController = new KioskAttendanceController();
