import { ClassStatusEnum } from '../types/interfaces';

interface RecurringScheduleSessionLike {
  date: Date;
  status?: ClassStatusEnum;
  notes?: string;
}

export interface RecurringScheduleLike {
  _id: unknown;
  date: Date;
  days_of_week?: number[];
  recurrence_end_date?: Date | null;
  sessions?: RecurringScheduleSessionLike[];
  status?: ClassStatusEnum;
}

export interface ExpandedScheduleInstance extends RecurringScheduleLike {
  _isRecurringInstance: true;
  _originalScheduleId: unknown;
  _instanceDate: string;
  date: Date;
  status: ClassStatusEnum;
}

// Expands a recurring ClassSchedule template (one document, anchored at `date`,
// recurring weekly on `days_of_week`) into one virtual instance per matching
// occurrence within [rangeStart, rangeEnd] (inclusive on both ends). A stored
// entry in `sessions` for a given occurrence date overrides that instance's
// status/notes; otherwise the instance defaults to SCHEDULED. An occurrence
// whose session status is DELETED was removed by the user and is omitted
// entirely rather than regenerated.
export function expandRecurringSchedule<T extends RecurringScheduleLike>(
  schedule: T,
  rangeStart: Date,
  rangeEnd: Date
): ExpandedScheduleInstance[] {
  const instances: ExpandedScheduleInstance[] = [];

  if (!schedule.days_of_week || schedule.days_of_week.length === 0) {
    return instances;
  }

  const recurrenceEnd = schedule.recurrence_end_date ? new Date(schedule.recurrence_end_date) : rangeEnd;
  const effectiveEnd = recurrenceEnd < rangeEnd ? recurrenceEnd : rangeEnd;
  const scheduleDate = new Date(schedule.date);

  let currentDate = new Date(scheduleDate > rangeStart ? scheduleDate : rangeStart);

  while (currentDate <= effectiveEnd) {
    const dayOfWeek = currentDate.getDay(); // 0=Sunday, 6=Saturday

    if (schedule.days_of_week.includes(dayOfWeek) && currentDate >= rangeStart && currentDate <= rangeEnd) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const existingSession = schedule.sessions?.find(
        (session) => new Date(session.date).toISOString().split('T')[0] === dateStr
      );
      const instanceDate = new Date(currentDate);

      if (existingSession?.status === ClassStatusEnum.DELETED) {
        // Occurrence was explicitly deleted by the user - do not regenerate it.
      } else if (existingSession) {
        instances.push({
          ...schedule,
          date: instanceDate,
          _isRecurringInstance: true,
          _originalScheduleId: schedule._id,
          _instanceDate: dateStr,
          status: existingSession.status ?? ClassStatusEnum.SCHEDULED,
          notes: existingSession.notes,
        } as unknown as ExpandedScheduleInstance);
      } else {
        const { sessions: _sessions, ...scheduleWithoutSessions } = schedule;
        instances.push({
          ...scheduleWithoutSessions,
          date: instanceDate,
          _isRecurringInstance: true,
          _originalScheduleId: schedule._id,
          _instanceDate: dateStr,
          status: ClassStatusEnum.SCHEDULED,
        } as unknown as ExpandedScheduleInstance);
      }
    }

    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return instances;
}
