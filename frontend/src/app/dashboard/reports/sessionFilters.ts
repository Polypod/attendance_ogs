import type { ReportPresetSessionFilter } from './types';

export const parseSessionKey = (key: string): ReportPresetSessionFilter | null => {
  const [classScheduleId, ymd] = key.split(':');
  if (!classScheduleId || !ymd) return null;
  return { classScheduleId, date: ymd };
};

export const sessionKeysToSessions = (keys: readonly string[]): ReportPresetSessionFilter[] => {
  const sessions: ReportPresetSessionFilter[] = [];
  for (const key of keys) {
    const parsed = parseSessionKey(key);
    if (parsed) sessions.push(parsed);
  }
  return sessions;
};
