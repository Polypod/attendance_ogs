import { ReportPresetService, ForbiddenError } from '../../services/ReportPresetService';
import { ReportPresetModel } from '../../models/ReportPreset';
import { UserModel } from '../../models/User';
import { UserRoleEnum, UserStatusEnum } from '../../types/interfaces';

describe('ReportPresetService', () => {
  let service: ReportPresetService;

  beforeEach(() => {
    service = new ReportPresetService();
  });

  const createUser = async (role: UserRoleEnum, email: string) => {
    return await UserModel.create({
      email,
      password: 'ChangeMe123!',
      name: email.split('@')[0],
      role,
      status: UserStatusEnum.ACTIVE,
      created_by: 'test'
    });
  };

  it('lists only own private presets + shared presets for instructor', async () => {
    const instructorA = await createUser(UserRoleEnum.INSTRUCTOR, 'inst-a@example.com');
    const instructorB = await createUser(UserRoleEnum.INSTRUCTOR, 'inst-b@example.com');
    const admin = await createUser(UserRoleEnum.ADMIN, 'admin@example.com');

    const aPrivate = await ReportPresetModel.create({
      owner_user_id: instructorA._id,
      name: 'A private',
      shared: false,
      schemaVersion: 1,
      state: { mode: 'raw', from: '2026-04-01', to: '2026-04-02' }
    });

    const bPrivate = await ReportPresetModel.create({
      owner_user_id: instructorB._id,
      name: 'B private',
      shared: false,
      schemaVersion: 1,
      state: { mode: 'raw', from: '2026-04-01', to: '2026-04-02' }
    });

    const shared = await ReportPresetModel.create({
      owner_user_id: admin._id,
      name: 'Shared',
      shared: true,
      schemaVersion: 1,
      state: { mode: 'aggregate', groupBy: 'student', from: '2026-04-01', to: '2026-04-02' }
    });

    const result = await service.listPresets({
      _id: instructorA._id.toString(),
      role: UserRoleEnum.INSTRUCTOR
    });

    const ids = result.map((p) => p._id.toString());
    expect(ids).toContain(aPrivate._id.toString());
    expect(ids).toContain(shared._id.toString());
    expect(ids).not.toContain(bPrivate._id.toString());
  });

  it('forces shared=false for instructor create', async () => {
    const instructor = await createUser(UserRoleEnum.INSTRUCTOR, 'inst-create@example.com');

    const created = await service.createPreset(
      { _id: instructor._id.toString(), role: UserRoleEnum.INSTRUCTOR },
      {
        name: 'Try shared',
        shared: true,
        schemaVersion: 1,
        state: { mode: 'raw', from: '2026-04-01', to: '2026-04-02' }
      }
    );

    expect(created.shared).toBe(false);
  });

  it('blocks instructor from updating shared preset', async () => {
    const instructor = await createUser(UserRoleEnum.INSTRUCTOR, 'inst-upd@example.com');
    const admin = await createUser(UserRoleEnum.ADMIN, 'admin-upd@example.com');

    const shared = await ReportPresetModel.create({
      owner_user_id: admin._id,
      name: 'Shared',
      shared: true,
      schemaVersion: 1,
      state: { mode: 'aggregate', groupBy: 'student', from: '2026-04-01', to: '2026-04-02' }
    });

    await expect(
      service.updatePreset(
        { _id: instructor._id.toString(), role: UserRoleEnum.INSTRUCTOR },
        shared._id.toString(),
        { name: 'Nope' }
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows admin to update shared preset', async () => {
    const admin = await createUser(UserRoleEnum.ADMIN, 'admin-shared@example.com');

    const shared = await ReportPresetModel.create({
      owner_user_id: admin._id,
      name: 'Shared',
      shared: true,
      schemaVersion: 1,
      state: { mode: 'aggregate', groupBy: 'student', from: '2026-04-01', to: '2026-04-02' }
    });

    const updated = await service.updatePreset(
      { _id: admin._id.toString(), role: UserRoleEnum.ADMIN },
      shared._id.toString(),
      { name: 'Shared v2' }
    );

    expect(updated?.name).toBe('Shared v2');
  });

  it('blocks admin from modifying another user\'s private preset', async () => {
    const adminA = await createUser(UserRoleEnum.ADMIN, 'admin-a@example.com');
    const adminB = await createUser(UserRoleEnum.ADMIN, 'admin-b@example.com');

    const privatePreset = await ReportPresetModel.create({
      owner_user_id: adminA._id,
      name: 'Admin A private',
      shared: false,
      schemaVersion: 1,
      state: { mode: 'raw', from: '2026-04-01', to: '2026-04-02' }
    });

    await expect(
      service.updatePreset(
        { _id: adminB._id.toString(), role: UserRoleEnum.ADMIN },
        privatePreset._id.toString(),
        { name: 'hack' }
      )
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
