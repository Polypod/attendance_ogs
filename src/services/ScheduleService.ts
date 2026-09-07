import { ClassScheduleModel } from '../models/ClassSchedule';
import { ClassStatusEnum, ClassScheduleSession } from '../types/interfaces';
import { logger } from '../utils/logger';

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

      // Expand recurring schedules
      for (const schedule of recurringSchedules) {
        if (schedule.days_of_week && schedule.days_of_week.length > 0) {
          if (debug) {
            logger.debug('ScheduleService.expand_schedule', {
              scheduleId: schedule._id?.toString?.() ?? String(schedule._id),
              date: schedule.date,
              daysOfWeek: schedule.days_of_week,
              recurring: schedule.recurring,
            });
          }

          const recurrenceEnd = schedule.recurrence_end_date ? new Date(schedule.recurrence_end_date) : rangeEnd;
          const effectiveEnd = recurrenceEnd < rangeEnd ? recurrenceEnd : rangeEnd;
          const scheduleDate = new Date(schedule.date);

          // Start from the later of: schedule start date or range start date
          let currentDate = new Date(scheduleDate > rangeStart ? scheduleDate : rangeStart);

          while (currentDate <= effectiveEnd) {
            const dayOfWeek = currentDate.getDay(); // 0=Sunday, 6=Saturday

            if (schedule.days_of_week.includes(dayOfWeek)) {
              // Only include if date is within the requested range
              if (currentDate >= rangeStart && currentDate <= rangeEnd) {
                // Check if a session exists for this date
                const dateStr = currentDate.toISOString().split('T')[0];

                if (debug) {
                  logger.debug('ScheduleService.schedule_sessions', {
                    scheduleId: schedule._id?.toString?.() ?? String(schedule._id),
                    sessionCount: schedule.sessions?.length || 0,
                    sessions: schedule.sessions?.map((s: ClassScheduleSession) => ({
                      date: s.date.toISOString().split('T')[0],
                      instructor: (s as any)['S-instructor'] ?? (s as any).instructor,
                      status: s.status,
                    })),
                  });
                }

                const existingSession = schedule.sessions?.find(
                  (s: ClassScheduleSession) => s.date.toISOString().split('T')[0] === dateStr
                );

                // Create a new date object for this instance
                const instanceDate = new Date(currentDate);

                if (debug) {
                  logger.debug('ScheduleService.add_instance', { date: dateStr, dayOfWeek });
                }

                // If session exists for this date, use its data
                if (existingSession) {
                  if (debug) {
                    logger.debug('ScheduleService.matching_session_found', {
                      sessionDate: existingSession.date.toISOString().split('T')[0],
                      sessionInstructor: (existingSession as any)['S-instructor'],
                      sessionStatus: existingSession.status,
                    });
                  }

                  // Create expanded instance with session-specific data
                  // Keep sessions array for frontend to access S-instructor field
                  expandedSchedules.push({
                    ...schedule.toObject(),
                    date: instanceDate,
                    _isRecurringInstance: true,
                    _originalScheduleId: schedule._id,
                    _instanceDate: dateStr,
                    status: existingSession.status,
                    notes: existingSession.notes,
                  });
                } else {
                  if (debug) {
                    logger.debug('ScheduleService.no_session_for_date', { date: dateStr });
                  }

                  // No session yet, create instance without session-specific data
                  const { sessions: _sessions, ...scheduleWithoutSessions } = schedule.toObject();
                  expandedSchedules.push({
                    ...scheduleWithoutSessions,
                    date: instanceDate,
                    _isRecurringInstance: true,
                    _originalScheduleId: schedule._id,
                    _instanceDate: dateStr,
                    status: ClassStatusEnum.SCHEDULED,
                  });
                }
              }
            }

            // Move to next day
            currentDate = new Date(currentDate);
            currentDate.setDate(currentDate.getDate() + 1);
          }

          if (debug) {
            logger.debug('ScheduleService.instances_added', { count: expandedSchedules.length });
          }
        }
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
