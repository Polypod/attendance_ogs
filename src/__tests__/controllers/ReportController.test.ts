import { ReportController } from '../../controllers/ReportController';
import { ValidationError } from '../../utils/validators';

describe('ReportController', () => {
  const controller = new ReportController();
  const json = jest.fn();
  const status = jest.fn(() => ({ json })) as any;
  const res: any = { json, status };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns raw attendance report on success', async () => {
    const service = (controller as any).reportService;
    jest.spyOn(service, 'getRawAttendanceReport').mockResolvedValue({
      rows: [{ attendance_id: 'a1' }],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1
    });

    await controller.getRawAttendanceReport({ body: { from: '2026-04-01', to: '2026-04-02' } } as any, res);

    expect(json).toHaveBeenCalledWith({
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
    const service = (controller as any).reportService;
    jest.spyOn(service, 'getRawAttendanceReport').mockRejectedValue(new ValidationError('bad input'));

    await controller.getRawAttendanceReport({ body: {} } as any, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ success: false, message: 'bad input' });
  });

  it('returns 500 on unexpected error', async () => {
    const service = (controller as any).reportService;
    jest.spyOn(service, 'getRawAttendanceReport').mockRejectedValue(new Error('fail'));

    await controller.getRawAttendanceReport({ body: {} } as any, res);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to generate raw attendance report',
      error: 'fail'
    });
  });

  it('returns aggregated attendance report on success', async () => {
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

    expect(json).toHaveBeenCalledWith({
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
    const service = (controller as any).reportService;
    jest.spyOn(service, 'getAggregatedAttendanceReport').mockRejectedValue(new ValidationError('bad input'));

    await controller.getAggregatedAttendanceReport({ body: {} } as any, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ success: false, message: 'bad input' });
  });

  it('returns 500 on aggregated unexpected error', async () => {
    const service = (controller as any).reportService;
    jest.spyOn(service, 'getAggregatedAttendanceReport').mockRejectedValue(new Error('fail'));

    await controller.getAggregatedAttendanceReport({ body: {} } as any, res);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to generate aggregated attendance report',
      error: 'fail'
    });
  });
});
