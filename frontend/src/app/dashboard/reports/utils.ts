import type { ColumnDefinition, ColumnKey } from './types';

export const normalizeApiErrorMessage = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes('<html') || lower.includes('<!doctype html')) {
    return 'API returned HTML instead of JSON. Check that NEXT_PUBLIC_API_URL points to the backend (e.g. http://localhost:4000) and that the backend is running.';
  }
  return message;
};

export const formatDateSv = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('sv-SE');
  } catch {
    return iso;
  }
};

export const isoToYmd = (iso: string) => {
  if (!iso) return '';
  if (iso.length >= 10) return iso.slice(0, 10);
  return iso;
};

export const sessionKey = (classScheduleId: string, ymd: string) => `${classScheduleId}:${ymd}`;

export const getTodayIsoDate = () => new Date().toISOString().slice(0, 10);

export const addDaysIsoDate = (isoDate: string, days: number) => {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const orderColumns = (columns: readonly ColumnDefinition[], order: readonly ColumnKey[] | undefined) => {
  const byKey = new Map<ColumnKey, ColumnDefinition>(columns.map((c) => [c.key, c]));
  const result: ColumnDefinition[] = [];
  const seen = new Set<ColumnKey>();

  for (const key of order ?? []) {
    const col = byKey.get(key);
    if (!col) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(col);
  }

  for (const col of columns) {
    if (seen.has(col.key)) continue;
    seen.add(col.key);
    result.push(col);
  }

  return result;
};
