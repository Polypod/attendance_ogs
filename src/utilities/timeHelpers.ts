// src/utils/timeHelpers.ts - Time utility functions
import moment from 'moment';

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

  static getDayOfWeek(date: Date): string {
    return moment(date).format('dddd').toLowerCase();
  }
}