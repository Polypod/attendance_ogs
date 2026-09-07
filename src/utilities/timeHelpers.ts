// src/utils/timeHelpers.ts - Time utility functions
import moment from 'moment';
import { DayOfWeekEnum } from '../types/interfaces';

export class TimeHelpers {
  static getCurrentTime(): string {
    return moment().format('HH:mm');
  }

  static isClassStartingSoon(startTime: string, thresholdMinutes: number = 15): boolean {
    const now = moment();
    const classStart = moment(startTime, 'HH:mm');
    const diff = classStart.diff(now, 'minutes');
    return diff >= 0 && diff <= thresholdMinutes;
  }

  static isClassCurrent(startTime: string, endTime: string): boolean {
    const now = moment();
    const start = moment(startTime, 'HH:mm');
    const end = moment(endTime, 'HH:mm');
    return now.isBetween(start, end);
  }

  static getNextClassTime(schedules: any[]): any | null {
    const now = moment();
    const currentTime = now.format('HH:mm');

    // Find next class today
    const todayClasses = schedules.filter(schedule => {
      return schedule.start_time > currentTime;
    });

    if (todayClasses.length > 0) {
      return todayClasses.sort((a, b) => a.start_time.localeCompare(b.start_time))[0];
    }

    return null;
  }

  static formatTimeRange(startTime: string, endTime: string): string {
    return `${startTime}-${endTime}`;
  }

  static getDayOfWeek(date: Date | string): DayOfWeekEnum | undefined {
    const parsedDate = moment.utc(date);

    if (!parsedDate.isValid()) {
      return undefined;
    }

    return parsedDate.format('dddd').toLowerCase() as DayOfWeekEnum;
  }

  static normalizeScheduleDayOfWeek(
    schedule: { date?: Date | string; day_of_week?: string | null },
    fallbackDate?: Date | string
  ): DayOfWeekEnum | undefined {
    const normalizedDayOfWeek = schedule.day_of_week?.trim().toLowerCase();

    if (normalizedDayOfWeek) {
      return normalizedDayOfWeek as DayOfWeekEnum;
    }

    const date = schedule.date ?? fallbackDate;
    if (!date) {
      return undefined;
    }

    return TimeHelpers.getDayOfWeek(date);
  }
}