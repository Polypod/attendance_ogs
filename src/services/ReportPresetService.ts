import { ReportPresetModel, IReportPresetDocument } from '@/models/ReportPreset';
import { CreateReportPresetDto, UpdateReportPresetDto, UserRoleEnum, User } from '@/types/interfaces';

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

type Actor = Pick<User, '_id' | 'role'>;

export class ReportPresetService {
  async listPresets(actor: Actor): Promise<IReportPresetDocument[]> {
    if (!actor._id) {
      throw new ForbiddenError('Authentication required');
    }

    return await ReportPresetModel.find({
      $or: [{ owner_user_id: actor._id }, { shared: true }]
    }).sort({ shared: -1, updated_at: -1, _id: -1 });
  }

  async createPreset(actor: Actor, dto: CreateReportPresetDto): Promise<IReportPresetDocument> {
    if (!actor._id) {
      throw new ForbiddenError('Authentication required');
    }

    const shared = actor.role === UserRoleEnum.INSTRUCTOR ? false : (dto.shared ?? false);

    return await ReportPresetModel.create({
      owner_user_id: actor._id,
      name: dto.name,
      shared,
      schemaVersion: dto.schemaVersion ?? 1,
      state: dto.state
    });
  }

  async updatePreset(
    actor: Actor,
    id: string,
    dto: UpdateReportPresetDto
  ): Promise<IReportPresetDocument | null> {
    if (!actor._id) {
      throw new ForbiddenError('Authentication required');
    }

    const preset = await ReportPresetModel.findById(id);
    if (!preset) return null;

    const ownerId = preset.owner_user_id.toString();

    if (actor.role === UserRoleEnum.INSTRUCTOR) {
      if (preset.shared) {
        throw new ForbiddenError('Instructors cannot modify shared presets');
      }
      if (ownerId !== actor._id) {
        throw new ForbiddenError('You can only modify your own presets');
      }
    } else if (actor.role === UserRoleEnum.ADMIN) {
      if (!preset.shared && ownerId !== actor._id) {
        throw new ForbiddenError('Admins can only modify their own private presets');
      }
    } else {
      throw new ForbiddenError('You do not have permission to perform this action');
    }

    if (dto.name !== undefined) preset.name = dto.name;
    if (dto.schemaVersion !== undefined) preset.schemaVersion = dto.schemaVersion;
    if (dto.state !== undefined) preset.state = dto.state;

    if (actor.role === UserRoleEnum.ADMIN && dto.shared !== undefined) {
      preset.shared = dto.shared;
    }
    if (actor.role === UserRoleEnum.INSTRUCTOR) {
      preset.shared = false;
    }

    await preset.save();
    return preset;
  }

  async deletePreset(actor: Actor, id: string): Promise<IReportPresetDocument | null> {
    if (!actor._id) {
      throw new ForbiddenError('Authentication required');
    }

    const preset = await ReportPresetModel.findById(id);
    if (!preset) return null;

    const ownerId = preset.owner_user_id.toString();

    if (actor.role === UserRoleEnum.INSTRUCTOR) {
      if (preset.shared) {
        throw new ForbiddenError('Instructors cannot delete shared presets');
      }
      if (ownerId !== actor._id) {
        throw new ForbiddenError('You can only delete your own presets');
      }
    } else if (actor.role === UserRoleEnum.ADMIN) {
      if (!preset.shared && ownerId !== actor._id) {
        throw new ForbiddenError('Admins can only delete their own private presets');
      }
    } else {
      throw new ForbiddenError('You do not have permission to perform this action');
    }

    await preset.deleteOne();
    return preset;
  }
}
