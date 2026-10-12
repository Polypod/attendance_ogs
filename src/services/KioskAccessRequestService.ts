import crypto from 'crypto';
import { Types } from 'mongoose';
import { AttendanceKioskModel } from '../models/AttendanceKiosk';
import { KioskAccessRequestModel } from '../models/KioskAccessRequest';
import { hashKioskAccessKey, KioskManagementError } from './KioskManagementService';

export interface PendingKioskRequest {
  id: string;
  name: string;
  requestedAt: Date;
  ipAddress: string;
  userAgent: string;
}

export class KioskAccessRequestService {
  async requestAccess(name: string, ipAddress: string, userAgent: string): Promise<{ id: string; requestToken: string }> {
    const normalizedName = name.trim();
    if (await AttendanceKioskModel.exists({ name: normalizedName })) {
      throw new KioskManagementError(409, 'A kiosk with that name already exists');
    }
    const requestToken = crypto.randomBytes(32).toString('base64url');
    const request = await KioskAccessRequestModel.create({
      name: normalizedName,
      token_hash: hashKioskAccessKey(requestToken),
      ip_address: ipAddress.slice(0, 100) || 'Okänd',
      user_agent: userAgent.slice(0, 500) || 'Okänd enhet',
    });
    return { id: request._id.toString(), requestToken };
  }

  async getStatus(id: string, requestToken: string): Promise<{ status: 'pending' | 'approved' }> {
    if (!Types.ObjectId.isValid(id) || !requestToken) {
      throw new KioskManagementError(404, 'Access request not found');
    }
    const request = await KioskAccessRequestModel.findOne({
      _id: new Types.ObjectId(id),
      token_hash: hashKioskAccessKey(requestToken),
    });
    if (!request) throw new KioskManagementError(404, 'Access request not found');
    return { status: request.status };
  }

  async listPending(): Promise<PendingKioskRequest[]> {
    const requests = await KioskAccessRequestModel.find({ status: 'pending' }).sort({ created_at: 1 });
    return requests.map((request) => ({
      id: request._id.toString(),
      name: request.name,
      requestedAt: request.created_at,
      ipAddress: request.ip_address,
      userAgent: request.user_agent,
    }));
  }

  async approve(id: string, adminId: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new KioskManagementError(400, 'Invalid access request ID');
    const request = await KioskAccessRequestModel.findOne({ _id: new Types.ObjectId(id), status: 'pending' }).select('+token_hash');
    if (!request) throw new KioskManagementError(404, 'Pending access request not found');

    // Reuse the device's secret as its kiosk key, but never disclose it to the admin.
    // Looking up the same hash also makes a retry safe if approval was interrupted.
    let kiosk = await AttendanceKioskModel.findOne({ name: request.name, token_hash: request.token_hash });
    if (!kiosk) {
      try {
        kiosk = await AttendanceKioskModel.create({
          name: request.name,
          token_hash: request.token_hash,
          created_by: adminId,
        });
      } catch (error: unknown) {
        if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 11000) throw error;
        kiosk = await AttendanceKioskModel.findOne({ name: request.name, token_hash: request.token_hash });
        if (!kiosk) throw new KioskManagementError(409, 'A kiosk with that name already exists');
      }
    }

    await KioskAccessRequestModel.updateOne(
      { _id: request._id, status: 'pending' },
      { $set: { status: 'approved', approved_by: adminId, approved_at: new Date(), kiosk_id: kiosk._id } }
    );
  }
}
