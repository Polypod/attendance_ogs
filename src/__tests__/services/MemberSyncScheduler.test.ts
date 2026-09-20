import { MemberSyncScheduler } from '../../services/MemberSyncScheduler';

describe('MemberSyncScheduler', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const configureSource = () => {
    process.env.OGS_SYNC_URL = 'https://ogs.example/api/attendance-sync/members';
    process.env.OGS_SYNC_API_KEY = 'test-key';
  };

  describe('isEnabled', () => {
    it('stays off unless explicitly enabled', () => {
      configureSource();
      delete process.env.MEMBER_SYNC_ENABLED;

      expect(MemberSyncScheduler.isEnabled()).toBe(false);
    });

    it('stays off when enabled but the source is not configured', () => {
      process.env.MEMBER_SYNC_ENABLED = 'true';
      delete process.env.OGS_SYNC_URL;
      delete process.env.OGS_SYNC_API_KEY;

      expect(MemberSyncScheduler.isEnabled()).toBe(false);
    });

    it('turns on when enabled and configured', () => {
      configureSource();
      process.env.MEMBER_SYNC_ENABLED = 'true';

      expect(MemberSyncScheduler.isEnabled()).toBe(true);
    });
  });

  describe('nextRunAt', () => {
    const scheduler = new MemberSyncScheduler();

    it('defaults to 03:00 Europe/Stockholm on the following day', () => {
      process.env.MEMBER_SYNC_TIMEZONE = 'Europe/Stockholm';

      // 2026-06-15 12:00 UTC is 14:00 in Stockholm (CEST), so the next 03:00
      // local falls on the 16th, which is 01:00 UTC.
      const next = scheduler.nextRunAt(new Date('2026-06-15T12:00:00.000Z'));

      expect(next.toISOString()).toBe('2026-06-16T01:00:00.000Z');
    });

    it('runs later the same day when the hour has not passed yet', () => {
      process.env.MEMBER_SYNC_TIMEZONE = 'Europe/Stockholm';

      // 2026-06-15 00:30 UTC is 02:30 local, so 03:00 local is still ahead.
      const next = scheduler.nextRunAt(new Date('2026-06-15T00:30:00.000Z'));

      expect(next.toISOString()).toBe('2026-06-15T01:00:00.000Z');
    });

    it('honours a configured hour and minute', () => {
      process.env.MEMBER_SYNC_TIMEZONE = 'UTC';
      process.env.MEMBER_SYNC_HOUR = '5';
      process.env.MEMBER_SYNC_MINUTE = '45';

      const next = scheduler.nextRunAt(new Date('2026-06-15T00:00:00.000Z'));

      expect(next.toISOString()).toBe('2026-06-15T05:45:00.000Z');
    });

    it('falls back to the default hour when the configured value is nonsense', () => {
      process.env.MEMBER_SYNC_TIMEZONE = 'UTC';
      process.env.MEMBER_SYNC_HOUR = '99';

      const next = scheduler.nextRunAt(new Date('2026-06-15T00:00:00.000Z'));

      expect(next.toISOString()).toBe('2026-06-15T03:00:00.000Z');
    });
  });

  it('does not arm a timer while disabled', () => {
    delete process.env.MEMBER_SYNC_ENABLED;
    const scheduler = new MemberSyncScheduler();
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

    scheduler.start();

    expect(setTimeoutSpy).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
    scheduler.stop();
  });
});
