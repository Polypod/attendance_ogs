export type DayOfWeekOption = {
  value: string;
  label: string;
  number: number;
};

export const DAYS_OF_WEEK: DayOfWeekOption[] = [
  { value: "monday", label: "Monday", number: 1 },
  { value: "tuesday", label: "Tuesday", number: 2 },
  { value: "wednesday", label: "Wednesday", number: 3 },
  { value: "thursday", label: "Thursday", number: 4 },
  { value: "friday", label: "Friday", number: 5 },
  { value: "saturday", label: "Saturday", number: 6 },
  { value: "sunday", label: "Sunday", number: 0 },
];

export function isoDatePart(isoLike: string): string {
  return isoLike.split("T")[0];
}

export function attendanceCountKey(scheduleId: string, scheduleDateIso: string): string {
  return `${scheduleId}-${scheduleDateIso}`;
}

export function filterAttendanceForScheduleDate<T extends { date?: string }>(
  attendance: T[],
  scheduleDateIso: string
): T[] {
  return attendance.filter((a) => {
    if (!a.date) return true;
    return isoDatePart(a.date) === scheduleDateIso;
  });
}

export function countPresentAttendance(attendance: Array<{ status?: string }>): number {
  return attendance.filter((a) => a.status === "present").length;
}

export function dayValuesToNumbers(
  dayValues: string[],
  dateIso: string,
  recurring: boolean,
  options: DayOfWeekOption[] = DAYS_OF_WEEK
): number[] {
  if (recurring) {
    return dayValues.map(
      (day) => options.find((d) => d.value === day)?.number ?? 0
    );
  }

  return [new Date(dateIso).getDay()];
}

export function daysOfWeekToValues(
  daysOfWeek: Array<string | number> | undefined,
  legacyDayOfWeek: string | undefined,
  options: DayOfWeekOption[] = DAYS_OF_WEEK
): string[] {
  if (daysOfWeek && daysOfWeek.length > 0) {
    return daysOfWeek
      .map((day) => {
        if (typeof day === "number") {
          return options.find((d) => d.number === day)?.value || "";
        }
        return day;
      })
      .filter((d) => d);
  }

  if (legacyDayOfWeek) return [legacyDayOfWeek];
  return [];
}
