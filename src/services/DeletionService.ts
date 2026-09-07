import { ClassModel } from '@/models/Class';
import { ClassScheduleModel } from '@/models/ClassSchedule';
import { AttendanceModel } from '@/models/Attendance';
import { logger } from '@/utils/logger';

export type DeleteClassCascadeResult = {
  deletedClass: unknown;
  deletedSchedulesCount: number;
  deletedAttendanceCount: number;
};

export type DeleteScheduleCascadeResult = {
  deletedSchedule: unknown;
  deletedAttendanceCount: number;
};

export class DeletionService {
  async deleteScheduleCascade(id: string): Promise<DeleteScheduleCascadeResult | null> {
    const existingSchedule = await ClassScheduleModel.findById(id);
    if (!existingSchedule) return null;

    const attendanceResult = await AttendanceModel.deleteMany({ class_schedule_id: id });
    const deletedAttendanceCount = attendanceResult.deletedCount ?? 0;

    await ClassScheduleModel.deleteOne({ _id: id });

    logger.info('DeletionService.schedule_deleted', {
      scheduleId: id,
      deletedAttendanceCount,
    });

    return {
      deletedSchedule: existingSchedule,
      deletedAttendanceCount,
    };
  }

  async deleteClassCascade(id: string): Promise<DeleteClassCascadeResult | null> {
    const existingClass = await ClassModel.findById(id);
    if (!existingClass) return null;

    const schedules = await ClassScheduleModel.find({ class_id: id }).select('_id').lean();
    const scheduleIds = schedules.map((s: any) => s._id);

    const attendanceResult =
      scheduleIds.length > 0
        ? await AttendanceModel.deleteMany({ class_schedule_id: { $in: scheduleIds } })
        : { deletedCount: 0 };

    const deletedAttendanceCount = (attendanceResult as any).deletedCount ?? 0;

    const schedulesResult = await ClassScheduleModel.deleteMany({ class_id: id });
    const deletedSchedulesCount = schedulesResult.deletedCount ?? 0;

    await ClassModel.deleteOne({ _id: id });

    logger.info('DeletionService.class_deleted', {
      classId: id,
      deletedSchedulesCount,
      deletedAttendanceCount,
    });

    return {
      deletedClass: existingClass,
      deletedSchedulesCount,
      deletedAttendanceCount,
    };
  }
}

export const deletionService = new DeletionService();
