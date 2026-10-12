import { AttendanceKioskModel } from '../../models/AttendanceKiosk';
import { KioskAccessRequestModel } from '../../models/KioskAccessRequest';
import { KioskAccessRequestService } from '../../services/KioskAccessRequestService';
import { hashKioskAccessKey } from '../../services/KioskManagementService';

describe('KioskAccessRequestService', () => {
  const service = new KioskAccessRequestService();

  it('keeps a device inactive until an admin approves its request', async () => {
    const { id, requestToken } = await service.requestAccess('Entré-iPad', '192.0.2.10', 'Mozilla/5.0 (iPad) Safari/605.1');

    expect(await service.getStatus(id, requestToken)).toEqual({ status: 'pending' });
    await expect(service.getStatus(id, 'wrong-token')).rejects.toMatchObject({ statusCode: 404 });
    expect(await AttendanceKioskModel.countDocuments()).toBe(0);

    const pending = await service.listPending();
    expect(pending).toEqual([expect.objectContaining({
      id,
      name: 'Entré-iPad',
      ipAddress: '192.0.2.10',
      userAgent: 'Mozilla/5.0 (iPad) Safari/605.1',
      requestedAt: expect.any(Date),
    })]);
    expect(JSON.stringify(pending)).not.toContain(requestToken);

    await service.approve(id, 'admin-1');

    expect(await service.getStatus(id, requestToken)).toEqual({ status: 'approved' });
    expect(await service.listPending()).toEqual([]);
    const kiosk = await AttendanceKioskModel.findOne({ name: 'Entré-iPad' }).select('+token_hash');
    expect(kiosk).toMatchObject({ active: true, created_by: 'admin-1' });
    expect(kiosk?.token_hash).toBe(hashKioskAccessKey(requestToken));
    expect((await KioskAccessRequestModel.findById(id))?.approved_at).toBeInstanceOf(Date);
  });

  it('does not approve a request if its name belongs to another kiosk', async () => {
    const { id, requestToken } = await service.requestAccess('Entré-iPad', '192.0.2.10', 'iPad');
    await AttendanceKioskModel.create({
      name: 'Entré-iPad', token_hash: hashKioskAccessKey('existing-key'), created_by: 'admin-1',
    });

    await expect(service.approve(id, 'admin-1')).rejects.toMatchObject({ statusCode: 409 });
    expect(await service.getStatus(id, requestToken)).toEqual({ status: 'pending' });
    await expect(service.requestAccess('Entré-iPad', '192.0.2.10', 'iPad')).rejects.toMatchObject({ statusCode: 409 });
  });
});
