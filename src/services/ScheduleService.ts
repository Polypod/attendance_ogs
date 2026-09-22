import { ClassScheduleModel } from '../models/ClassSchedule';
import { logger } from '../utils/logger';
import { expandRecurringSchedule } from './scheduleExpansion';

export interface GetAllSchedulesParams {
  startDate?: string;
  endDate?: string;
  classId?: string;
  expandRecurring?: boolean;
}

export class ScheduleService {
  async getAllSchedules(params: GetAllSchedulesParams): Promise<any[]> {
    const { startDate, endDate, classId, expandRecurring } = params;
    const debug = logger.isDebugEnabled();

    if (debug) {
      logger.debug('ScheduleService.getAllSchedules_called', {
        startDate,
        endDate,
        expandRecurring,
        classId,
      });
    }

    // If expandRecurring is true and date range provided, generate instances
    if (expandRecurring && startDate && endDate) {
      const rangeStart = new Date(startDate);
      const rangeEnd = new Date(endDate);

      // For recurring schedules, we need to fetch all that might overlap with range
      const recurringQuery: Record<string, unknown> = { recurring: true };
      if (classId) recurringQuery.class_id = classId;

      // Fetch recurring schedules that started before or during range end
      recurringQuery.$or = [
        { recurrence_end_date: { $exists: false } },
        { recurrence_end_date: null },
        { recurrence_end_date: { $gte: rangeStart } },
      ];
      recurringQuery.date = { $lte: rangeEnd };

      // Use lean() to bypass Mongoose document cache and get raw MongoDB data
      const recurringSchedulesRaw = await ClassScheduleModel.find(recurringQuery)
        .lean()
        .populate('class_id', 'name instructor categories')
        .sort({ date: 1, start_time: 1 });

      // Convert lean results back to Mongoose documents for compatibility
      const recurringSchedules = recurringSchedulesRaw.map((doc: any) => ({
        ...doc,
        toObject: () => doc,
        _id: doc._id,
      }));

      if (debug) {
        logger.debug('ScheduleService.recurring_schedules_found', { count: recurringSchedules.length });
      }

      // Fetch non-recurring schedules within range
      const nonRecurringQuery: Record<string, unknown> = {
        recurring: { $ne: true },
        date: {
          $gte: rangeStart,
          $lte: rangeEnd,
        },
      };
      if (classId) nonRecurringQuery.class_id = classId;

      const nonRecurringSchedules = await ClassScheduleModel.find(nonRecurringQuery)
        .populate('class_id', 'name instructor categories')
        .sort({ date: 1, start_time: 1 });

      const expandedSchedules: any[] = [];

      // Expand recurring schedules into one virtual instance per matching occurrence
      for (const schedule of recurringSchedules) {
        const instances = expandRecurringSchedule(schedule.toObject(), rangeStart, rangeEnd);
        if (debug && instances.length > 0) {
          logger.debug('ScheduleService.expand_schedule', {
            scheduleId: schedule._id?.toString?.() ?? String(schedule._id),
            date: schedule.date,
            daysOfWeek: schedule.days_of_week,
            instancesAdded: instances.length,
          });
        }
        expandedSchedules.push(...instances);
      }

      // Add non-recurring schedules
      nonRecurringSchedules.forEach((schedule) => {
        expandedSchedules.push(schedule.toObject());
      });

      // Sort all schedules by date and time
      expandedSchedules.sort((a, b) => {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.start_time.localeCompare(b.start_time);
      });

      if (debug) {
        logger.debug('ScheduleService.expanded_schedules_returning', { count: expandedSchedules.length });
      }

      return expandedSchedules;
    }

    // Simple query when not expanding
    const query: Record<string, unknown> = {};

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (classId) {
      query.class_id = classId;
    }

    const schedules = await ClassScheduleModel.find(query)
      .populate('class_id', 'name instructor categories')
      .sort({ date: 1, start_time: 1 });

    return schedules;
  }
}

export const scheduleService = new ScheduleService();
