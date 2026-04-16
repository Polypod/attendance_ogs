import { ReportPresetController } from '../../controllers/ReportPresetController';
import { ForbiddenError } from '../../services/ReportPresetService';
import { UserRoleEnum, UserStatusEnum } from '../../types/interfaces';

describe('ReportPresetController', () => {
  const controller = new ReportPresetController();
  const json = jest.fn();
  const status = jest.fn(() => ({ json })) as any;
  const res: any = { json, status };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const user = {
    _id: 'u1',
    email: 'a@b.com',
    name: 'A',
    role: UserRoleEnum.INSTRUCTOR,
    status: UserStatusEnum.ACTIVE,
    created_by: 'seed'
  };

  it('returns presets on success', async () => {
    const service = (controller as any).reportPresetService;
    jest.spyOn(service, 'listPresets').mockResolvedValue([{ _id: 'p1' }] as any);

    await controller.listPresets({ user } as any, res);

    expect(json).toHaveBeenCalledWith({ success: true, data: [{ _id: 'p1' }] });
  });

  it('returns 201 on create success', async () => {
    const service = (controller as any).reportPresetService;
    jest.spyOn(service, 'createPreset').mockResolvedValue({ _id: 'p1' } as any);

    await controller.createPreset({ user, body: { name: 'n', state: {} } } as any, res);

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({ success: true, data: { _id: 'p1' } });
  });

  it('returns 404 when updating missing preset', async () => {
    const service = (controller as any).reportPresetService;
    jest.spyOn(service, 'updatePreset').mockResolvedValue(null);

    await controller.updatePreset({ user, params: { id: 'p1' }, body: { name: 'x' } } as any, res);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ success: false, message: 'Report preset not found' });
  });

  it('returns 403 on forbidden error', async () => {
    const service = (controller as any).reportPresetService;
    jest.spyOn(service, 'deletePreset').mockRejectedValue(new ForbiddenError('no'));

    await controller.deletePreset({ user, params: { id: 'p1' } } as any, res);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ success: false, message: 'no' });
  });

  it('returns 500 on unexpected error', async () => {
    const service = (controller as any).reportPresetService;
    jest.spyOn(service, 'listPresets').mockRejectedValue(new Error('fail'));

    await controller.listPresets({ user } as any, res);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to list report presets',
      error: 'fail'
    });
  });
});
