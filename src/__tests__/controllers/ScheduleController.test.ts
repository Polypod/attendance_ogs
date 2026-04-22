import { ScheduleController } from '../../controllers/ScheduleController';
import { scheduleService } from '../../services/ScheduleService';
import { ClassScheduleModel } from '../../models/ClassSchedule';
import { logger } from '../../utils/logger';

jest.mock('../../services/ScheduleService', () => ({
  scheduleService: {
    getAllSchedules: jest.fn(),
  },
}));

jest.mock('../../models/ClassSchedule', () => ({
  ClassScheduleModel: {
    find: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    isDebugEnabled: jest.fn(() => false),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../services/DeletionService', () => ({
  deletionService: {
    deleteScheduleCascade: jest.fn(),
  },
}));

describe('ScheduleController', () => {
  const controller = new ScheduleController();

  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAllSchedules: passes parsed query to scheduleService', async () => {
    (scheduleService.getAllSchedules as jest.Mock).mockResolvedValue([{ _id: 'sc1' }]);

    const req: any = {
      query: { startDate: '2026-01-01', endDate: '2026-01-31', classId: 'c1', expandRecurring: 'true' },
    };

    await controller.getAllSchedules(req, res);

    expect(scheduleService.getAllSchedules).toHaveBeenCalledWith({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      classId: 'c1',
      expandRecurring: true,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ _id: 'sc1' }] });
  });

  it('getAllSchedules: returns 500 on failure and logs error', async () => {
    (scheduleService.getAllSchedules as jest.Mock).mockRejectedValue(new Error('boom'));

    await controller.getAllSchedules({ query: {} } as any, res);

    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Error fetching class schedules',
        error: 'boom',
      })
    );
  });

  it('getSchedulesByDateRange: returns 400 when missing params', async () => {
    await controller.getSchedulesByDateRange({ query: { startDate: '2026-01-01' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Both startDate and endDate query parameters are required',
    });
    expect(ClassScheduleModel.find).not.toHaveBeenCalled();
  });

  it('getSchedulesByDateRange: queries db and returns schedules', async () => {
    const sort = jest.fn().mockResolvedValue([{ _id: 'sc1' }]);
    const populate = jest.fn(() => ({ sort }));
    (ClassScheduleModel.find as jest.Mock).mockReturnValue({ populate });

    const req: any = { query: { startDate: '2026-01-01', endDate: '2026-01-02' } };
    await controller.getSchedulesByDateRange(req, res);

    expect(ClassScheduleModel.find).toHaveBeenCalled();
    expect(populate).toHaveBeenCalledWith('class_id', 'name instructor');
    expect(sort).toHaveBeenCalledWith({ date: 1, start_time: 1 });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ _id: 'sc1' }] });
  });
});
