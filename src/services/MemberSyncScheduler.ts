// src/services/MemberSyncScheduler.ts - Nightly member sync trigger
//
// A dedicated cron dependency would be overkill for a single daily job, so the
// next run is computed with moment-timezone (already used for class scheduling)
// and armed with a plain timer.

import moment from 'moment-timezone';
import { MemberSyncService } from './MemberSyncService';
import { logger } from '../utils/logger';

const DEFAULT_TIMEZONE = 'Europe/Stockholm';
const DEFAULT_HOUR = 3;
const DEFAULT_MINUTE = 0;

export class MemberSyncScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly memberSyncService = new MemberSyncService()) {}

  static isEnabled(): boolean {
    if (process.env.MEMBER_SYNC_ENABLED?.trim().toLowerCase() !== 'true') {
      return false;
    }
    return Boolean(process.env.OGS_SYNC_URL && process.env.OGS_SYNC_API_KEY);
  }

  /** Local wall-clock time of the next run, in the configured timezone. */
  nextRunAt(from: Date = new Date()): Date {
    const timezone = process.env.MEMBER_SYNC_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
    const hour = this.readNumber('MEMBER_SYNC_HOUR', DEFAULT_HOUR, 0, 23);
    const minute = this.readNumber('MEMBER_SYNC_MINUTE', DEFAULT_MINUTE, 0, 59);

    let next = moment.tz(from, timezone).set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    });

    if (!next.isAfter(moment.tz(from, timezone))) {
      next = next.add(1, 'day');
    }

    return next.toDate();
  }

  start(): void {
    if (!MemberSyncScheduler.isEnabled()) {
      logger.info('member_sync_scheduler_disabled');
      return;
    }

    this.scheduleNext();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNext(): void {
    const nextRun = this.nextRunAt();
    const delayMs = Math.max(nextRun.getTime() - Date.now(), 0);

    this.stop();
    this.timer = setTimeout(() => {
      void this.runOnce();
    }, delayMs);
    // Do not keep the process alive purely for the next sync.
    this.timer.unref?.();

    logger.info('member_sync_scheduled', { nextRun: nextRun.toISOString() });
  }

  private async runOnce(): Promise<void> {
    // A run that overruns its window must not stack on top of the next one.
    if (this.running) {
      logger.warn('member_sync_skipped_still_running');
      this.scheduleNext();
      return;
    }

    this.running = true;
    try {
      await this.memberSyncService.apply('scheduler');
    } catch (error) {
      // Already logged and recorded by the service; swallow so the schedule survives.
      logger.warn('member_sync_scheduled_run_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
      this.scheduleNext();
    }
  }

  private readNumber(name: string, fallback: number, min: number, max: number): number {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;

    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      logger.warn('member_sync_invalid_schedule_value', { name, value: raw, fallback });
      return fallback;
    }

    return parsed;
  }
}
