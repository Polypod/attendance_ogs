import { EventEmitter } from 'events';
import { ReportController } from '../../controllers/ReportController';
import { ValidationError } from '../../utils/validators';

type AsyncCursor<T> = {
  [Symbol.asyncIterator](): AsyncIterator<T>;
  close?: () => Promise<void>;
};

function makeCursor<T>(rows: T[], opts?: { onAfterYield?: (index: number) => void }): AsyncCursor<T> {
  let i = 0;
  return {
    async *[Symbol.asyncIterator]() {
      while (i < rows.length) {
        const idx = i;
        const row = rows[i++];
        yield row;
        opts?.onAfterYield?.(idx);
      }
    }
  };
}

function makeReq(body: any) {
  const req = new EventEmitter() as any;
  req.body = body;
  return req;
}

function makeJsonRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  } as any;
}

function makeStreamRes(opts?: { backpressureOnCalls?: number[] }) {
  const writes: string[] = [];
  const res = new EventEmitter() as any;

  res.headersSent = false;
  res.writableEnded = false;

  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.setHeader = jest.fn();

  const backpressureOn = new Set(opts?.backpressureOnCalls ?? []);
  let writeCall = 0;

  res.write = jest.fn((chunk: string) => {
    writeCall += 1;
    res.headersSent = true;
    writes.push(chunk);

    if (backpressureOn.has(writeCall)) {
      setImmediate(() => res.emit('drain'));
      return false;
    }

    return true;
  });

  res.end = jest.fn(() => {
    res.writableEnded = true;
    return res;
  });

  res.__writes = writes;
  return res;
}

describe('ReportController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRawAttendanceReport', () => {
    it('returns raw attendance report on success', async () => {
      const controller = new ReportController();
      const res = makeJsonRes();

      const service = (controller as any).reportService;
      jest.spyOn(service, 'getRawAttendanceReport').mockResolvedValue({
        rows: [{ attendance_id: 'a1' }],
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1
      });

      await controller.getRawAttendanceReport({ body: { from: '2026-04-01', to: '2026-04-02' } } as any, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          rows: [{ attendance_id: 'a1' }],
          page: 1,
          pageSize: 25,
          total: 1,
          totalPages: 1
        }
      });
    });

    it('returns 400 on validation error', async () => {
      const controller = new ReportController();
      const res = makeJsonRes();

      const service = (controller as any).reportService;
      jest.spyOn(service, 'getRawAttendanceReport').mockRejectedValue(new ValidationError('bad input'));

      await controller.getRawAttendanceReport({ body: {} } as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'bad input' });
    });

    it('returns 500 on unexpected error', async () => {
      const controller = new ReportController();
      const res = makeJsonRes();

      const service = (controller as any).reportService;
      jest.spyOn(service, 'getRawAttendanceReport').mockRejectedValue(new Error('fail'));

      await controller.getRawAttendanceReport({ body: {} } as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to generate raw attendance report',
        error: 'fail'
      });
    });

    it('returns 500 on unknown error shape', async () => {
      const controller = new ReportController({
        getRawAttendanceReport: async () => {
          throw 'nope';
        }
      } as any);
      const res = makeJsonRes();

      await controller.getRawAttendanceReport({ body: {} } as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Failed to generate raw attendance report',
          error: 'Unknown error'
        })
      );
    });
  });

  describe('getAggregatedAttendanceReport', () => {
    it('returns aggregated attendance report on success', async () => {
      const controller = new ReportController();
      const res = makeJsonRes();

      const service = (controller as any).reportService;
      jest.spyOn(service, 'getAggregatedAttendanceReport').mockResolvedValue({
        rows: [{ instructor: 'Instructor A', presentCount: 1, totalCount: 2 }],
        page: 1,
        pageSize: 25,
        total: 1,
        totalPages: 1
      });

      await controller.getAggregatedAttendanceReport(
        { body: { from: '2026-04-01', to: '2026-04-02', groupBy: 'instructor' } } as any,
        res
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          rows: [{ instructor: 'Instructor A', presentCount: 1, totalCount: 2 }],
          page: 1,
          pageSize: 25,
          total: 1,
          totalPages: 1
        }
      });
    });

    it('returns 400 on aggregated validation error', async () => {
      const controller = new ReportController();
      const res = makeJsonRes();

      const service = (controller as any).reportService;
      jest.spyOn(service, 'getAggregatedAttendanceReport').mockRejectedValue(new ValidationError('bad input'));

      await controller.getAggregatedAttendanceReport({ body: {} } as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'bad input' });
    });

    it('returns 500 on aggregated unexpected error', async () => {
      const controller = new ReportController();
      const res = makeJsonRes();

      const service = (controller as any).reportService;
      jest.spyOn(service, 'getAggregatedAttendanceReport').mockRejectedValue(new Error('fail'));

      await controller.getAggregatedAttendanceReport({ body: {} } as any, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to generate aggregated attendance report',
        error: 'fail'
      });
    });
  });

  describe('getRawAttendanceReportExportCsv', () => {
    it('streams CSV, formats date + recorded_at, and closes cursor', async () => {
      const close = jest.fn(async () => undefined);

      const cursor: any = makeCursor([
        {
          date: new Date('2026-01-02T00:00:00Z'),
          recorded_at: new Date('2026-01-02T10:00:00Z'),
          status: 'present',
          notes: 'ok'
        }
      ]);
      cursor.close = close;

      const controller = new ReportController({
        getRawAttendanceExportCursor: async () => cursor
      } as any);

      const req = makeReq({
        from: '2026-01-01',
        to: '2026-01-31',
        columns: ['date', 'recorded_at', 'status', 'notes']
      });
      const res = makeStreamRes();

      await controller.getRawAttendanceReportExportCsv(req as any, res as any);

      expect((res.write as jest.Mock).mock.calls[0][0]).toBe('\uFEFF');

      const joined = (res.__writes as string[]).join('');
      expect(joined).toContain('Date');
      expect(joined).toContain('Recorded At');
      expect(joined).toContain('2026-01-02');
      expect(joined).toContain('present');
      // Stockholm time: 10:00Z => 11:00 CET (January)
      expect(joined).toContain('2026-01-02 11:00:00');

      expect(close).toHaveBeenCalledTimes(1);
      expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('handles backpressure via drain and stops after abort', async () => {
      const close = jest.fn(async () => undefined);

      const req = makeReq({
        from: '2026-01-01',
        to: '2026-01-31',
        columns: ['date', 'status']
      });

      const cursor: any = makeCursor(
        [
          { date: new Date('2026-01-02T00:00:00Z'), status: 'present' },
          { date: new Date('2026-01-03T00:00:00Z'), status: 'absent' }
        ],
        {
          onAfterYield: (idx) => {
            if (idx === 0) {
              (req as any).emit('close');
            }
          }
        }
      );
      cursor.close = close;

      const controller = new ReportController({
        getRawAttendanceExportCursor: async () => cursor
      } as any);

      // Force backpressure on BOM write (call 1) and header row write (call 2)
      const res = makeStreamRes({ backpressureOnCalls: [1, 2] });

      await controller.getRawAttendanceReportExportCsv(req as any, res as any);

      const joined = (res.__writes as string[]).join('');
      expect(joined).toContain('2026-01-02');
      expect(joined).not.toContain('2026-01-03');

      expect(close).toHaveBeenCalledTimes(1);
      expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('returns 400 JSON when ValidationError occurs before headers are sent', async () => {
      const controller = new ReportController({
        getRawAttendanceExportCursor: async () => {
          throw new ValidationError('bad query');
        }
      } as any);

      const req = makeReq({ from: '2026-01-01', to: '2026-01-31', columns: ['date'] });
      const res: any = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        end: jest.fn()
      };

      await controller.getRawAttendanceReportExportCsv(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'bad query' });
      expect(res.end).not.toHaveBeenCalled();
    });

    it('ends response when error occurs after headers are sent', async () => {
      const controller = new ReportController({
        getRawAttendanceExportCursor: async () => {
          throw new ValidationError('late error');
        }
      } as any);

      const req = makeReq({ from: '2026-01-01', to: '2026-01-31', columns: ['date'] });
      const res: any = {
        headersSent: true,
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        end: jest.fn()
      };

      await controller.getRawAttendanceReportExportCsv(req as any, res as any);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('returns 500 JSON when a non-validation error occurs before headers are sent', async () => {
      const controller = new ReportController({
        getRawAttendanceExportCursor: async () => {
          throw new Error('boom');
        }
      } as any);

      const req = makeReq({ from: '2026-01-01', to: '2026-01-31', columns: ['date'] });
      const res: any = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        end: jest.fn()
      };

      await controller.getRawAttendanceReportExportCsv(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to export raw attendance report',
        error: 'boom'
      });
      expect(res.end).not.toHaveBeenCalled();
    });

    it('skips writeLine when request is already closed', async () => {
      const close = jest.fn(async () => undefined);
      const cursor: any = makeCursor([{ date: new Date('2026-01-02T00:00:00Z'), status: 'present' }]);
      cursor.close = close;

      const controller = new ReportController({
        getRawAttendanceExportCursor: async () => cursor
      } as any);

      const req: any = {
        body: { from: '2026-01-01', to: '2026-01-31', columns: ['date', 'status'] },
        on: jest.fn((event: string, cb: () => void) => {
          if (event === 'close') cb();
          return req;
        })
      };

      const res = makeStreamRes();

      await controller.getRawAttendanceReportExportCsv(req as any, res as any);

      // BOM is written before writeLine; header/rows are skipped.
      expect(res.__writes).toEqual(['\uFEFF']);
      expect(close).toHaveBeenCalledTimes(1);
      expect(res.end).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAggregatedAttendanceReportExportCsv', () => {
    it('streams aggregated CSV and supports unknown column labels', async () => {
      const cursor: any = makeCursor([
        {
          date: new Date('2026-01-02T00:00:00Z'),
          instructor: 'Sensei',
          presentCount: 1,
          totalCount: 2,
          unknown_col: 'x'
        },
        {
          date: undefined,
          instructor: 'Sensei',
          presentCount: 0,
          totalCount: 0,
          unknown_col: ''
        }
      ]);

      const controller = new ReportController({
        getAggregatedAttendanceExportCursor: async () => cursor
      } as any);

      const req = makeReq({
        groupBy: 'instructor',
        from: '2026-01-01',
        to: '2026-01-31',
        columns: ['date', 'instructor', 'presentCount', 'totalCount', 'unknown_col']
      });

      const res = makeStreamRes();

      await controller.getAggregatedAttendanceReportExportCsv(req as any, res as any);

      const joined = (res.__writes as string[]).join('');
      expect(joined).toContain('Date');
      expect(joined).toContain('Instructor');
      expect(joined).toContain('Present');
      expect(joined).toContain('Total');
      expect(joined).toContain('unknown_col');

      expect(joined).toContain('2026-01-02');
      expect(joined).toContain('Sensei');
      expect(res.end).toHaveBeenCalledTimes(1);
    });

    it('returns 400 JSON when ValidationError occurs before headers are sent', async () => {
      const controller = new ReportController({
        getAggregatedAttendanceExportCursor: async () => {
          throw new ValidationError('bad query');
        }
      } as any);

      const req = makeReq({ groupBy: 'instructor', from: '2026-01-01', to: '2026-01-31', columns: ['date'] });
      const res: any = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        end: jest.fn()
      };

      await controller.getAggregatedAttendanceReportExportCsv(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'bad query' });
      expect(res.end).not.toHaveBeenCalled();
    });

    it('ends response when a non-validation error occurs after headers are sent', async () => {
      const close = jest.fn(async () => undefined);
      const cursor: any = makeCursor(
        [{ date: new Date('2026-01-02T00:00:00Z'), instructor: 'Sensei', presentCount: 1, totalCount: 1 }],
        {
          onAfterYield: () => {
            throw new Error('iter boom');
          }
        }
      );
      cursor.close = close;

      const controller = new ReportController({
        getAggregatedAttendanceExportCursor: async () => cursor
      } as any);

      const req = makeReq({
        groupBy: 'instructor',
        from: '2026-01-01',
        to: '2026-01-31',
        columns: ['date', 'instructor', 'presentCount', 'totalCount']
      });

      const res = makeStreamRes();

      await controller.getAggregatedAttendanceReportExportCsv(req as any, res as any);

      // The cursor throws after yielding; controller should fall back to ending response.
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
    });
  });
});
