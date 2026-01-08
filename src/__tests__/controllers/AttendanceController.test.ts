import { AttendanceController } from '../../controllers/AttendanceController';

describe('AttendanceController', () => {
  const controller = new AttendanceController();
  const json = jest.fn();
  const status = jest.fn(() => ({ json })) as any;
  const res: any = { json, status };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns todays classes on success', async () => {
    const service = (controller as any).attendanceService;
    jest.spyOn(service, 'getClassesForDate').mockResolvedValue([{ id: 'c1' }]);

    await controller.getTodaysClasses({} as any, res);

    expect(json).toHaveBeenCalledWith({ success: true, data: [{ id: 'c1' }] });
  });

  it('handles errors when fetching todays classes', async () => {
    const service = (controller as any).attendanceService;
    jest.spyOn(service, 'getClassesForDate').mockRejectedValue(new Error('fail'));

    await controller.getTodaysClasses({} as any, res);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      success: false,
      message: "Error fetching today's classes",
      error: 'fail'
    });
  });

  it('returns next class', async () => {
    const service = (controller as any).attendanceService;
    jest.spyOn(service, 'getNextUpcomingClass').mockResolvedValue({ id: 'next' });

    await controller.getNextClass({} as any, res);

    expect(json).toHaveBeenCalledWith({ success: true, data: { id: 'next' } });
  });
});
