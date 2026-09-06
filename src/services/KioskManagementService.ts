import crypto from 'crypto';
import { Types } from 'mongoose';
import { AttendanceKioskModel, IAttendanceKioskDocument } from '../models/AttendanceKiosk';

export interface KioskSummary {
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

export class KioskManagementError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = 'KioskManagementError';
  }
}

export function hashKioskAccessKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function toKioskSummary(kiosk: IAttendanceKioskDocument): KioskSummary {
  return {
    id: kiosk._id.toString(),
    name: kiosk.name,
    active: kiosk.active,
    createdAt: kiosk.created_at,
    lastUsedAt: kiosk.last_used_at,
  };
}

export class KioskManagementService {
  private assertValidId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new KioskManagementError(400, 'Invalid kiosk ID');
    }
  }

  async listKiosks(): Promise<KioskSummary[]> {
    const kiosks = await AttendanceKioskModel.find({})
      .select('name active created_at last_used_at')
      .sort({ name: 1 });

    return kiosks.map(toKioskSummary);
  }

  async createKiosk(name: string, createdBy: string): Promise<{ kiosk: KioskSummary; accessKey: string }> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new KioskManagementError(400, 'Kiosk name is required');
    }

    const accessKey = crypto.randomBytes(32).toString('base64url');
    try {
      const kiosk = await AttendanceKioskModel.create({
        name: normalizedName,
        token_hash: hashKioskAccessKey(accessKey),
        created_by: createdBy,
      });
      return { kiosk: toKioskSummary(kiosk), accessKey };
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new KioskManagementError(409, 'A kiosk with that name already exists');
      }
      throw error;
    }
  }

  async rotateAccessKey(id: string): Promise<{ kiosk: KioskSummary; accessKey: string }> {
    this.assertValidId(id);
    const kioskId = new Types.ObjectId(id);
    const accessKey = crypto.randomBytes(32).toString('base64url');
    const kiosk = await AttendanceKioskModel.findOneAndUpdate(
      { _id: kioskId },
      { token_hash: hashKioskAccessKey(accessKey), active: true },
      { new: true, runValidators: true }
    ).select('+token_hash');

    if (!kiosk) {
      throw new KioskManagementError(404, 'Kiosk not found');
    }

    return { kiosk: toKioskSummary(kiosk), accessKey };
  }

  async setKioskStatus(id: string, active: boolean): Promise<KioskSummary> {
    this.assertValidId(id);
    if (typeof active !== 'boolean') {
      throw new KioskManagementError(400, 'Invalid kiosk active status');
    }
    const safeActive = active === true;
    const kioskId = new Types.ObjectId(id);
    const kiosk = await AttendanceKioskModel.findOneAndUpdate(
      { _id: kioskId },
      { active: safeActive },
      { new: true, runValidators: true }
    );

    if (!kiosk) {
      throw new KioskManagementError(404, 'Kiosk not found');
    }

    return toKioskSummary(kiosk);
  }

  async updateKioskName(id: string, newName: string): Promise<KioskSummary> {
    this.assertValidId(id);
    const kioskId = new Types.ObjectId(id);
    const normalizedName = newName.trim();
    if (!normalizedName) {
      throw new KioskManagementError(400, 'Kiosk name is required');
    }

    try {
      const kiosk = await AttendanceKioskModel.findOneAndUpdate(
        { _id: kioskId },
        { name: normalizedName },
        { new: true, runValidators: true }
      );

      if (!kiosk) {
        throw new KioskManagementError(404, 'Kiosk not found');
      }

      return toKioskSummary(kiosk);
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new KioskManagementError(409, 'A kiosk with that name already exists');
      }
      throw error;
    }
  }

  async deleteKiosk(id: string): Promise<void> {
    this.assertValidId(id);
    const kioskId = new Types.ObjectId(id);
    const kiosk = await AttendanceKioskModel.findOneAndDelete({ _id: kioskId });

    if (!kiosk) {
      throw new KioskManagementError(404, 'Kiosk not found');
    }
  }
}
