import { NextFunction, Request, Response } from 'express';
import { AttendanceKioskModel } from '../models/AttendanceKiosk';
import { hashKioskAccessKey } from '../services/KioskManagementService';

const KIOSK_ACCESS_HEADER = 'x-attendance-kiosk-key';

export async function authenticateKiosk(req: Request, res: Response, next: NextFunction): Promise<void> {
  const accessKey = req.header(KIOSK_ACCESS_HEADER)?.trim();
  if (!accessKey) {
    res.status(401).json({
      success: false,
      requestId: req.requestId,
      message: 'Kiosk access key is required',
    });
    return;
  }

  const kiosk = await AttendanceKioskModel.findOne({
    token_hash: hashKioskAccessKey(accessKey),
    active: true,
  }).select('name active');

  if (!kiosk) {
    res.status(401).json({
      success: false,
      requestId: req.requestId,
      message: 'Invalid or inactive kiosk access key',
    });
    return;
  }

  kiosk.last_used_at = new Date();
  await kiosk.save();
  req.kiosk = { _id: kiosk._id.toString(), name: kiosk.name };
  next();
}
