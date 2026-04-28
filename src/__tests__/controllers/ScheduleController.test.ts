import { ScheduleController } from '../../controllers/ScheduleController';
import { scheduleService } from '../../services/ScheduleService';
import { ClassScheduleModel } from '../../models/ClassSchedule';
import { logger } from '../../utils/logger';
import { deletionService } from '../../services/DeletionService';

jest.mock('../../services/ScheduleService', () => ({
  scheduleService: {
    getAllSchedules: jest.fn(),
  },
}));

jest.mock('../../models/ClassSchedule', () => {
  const ClassScheduleModelMock: any = jest.fn();
  ClassScheduleModelMock.find = jest.fn();
  ClassScheduleModelMock.findById = jest.fn();
  return {
    ClassScheduleModel: ClassScheduleModelMock,
  };
});

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

  it('getScheduleById: returns 404 when schedule missing', async () => {
    const populate = jest.fn().mockResolvedValue(null);
    (ClassScheduleModel.findById as jest.Mock).mockReturnValue({ populate });

    await controller.getScheduleById({ params: { id: 'missing' } } as any, res);

    expect(populate).toHaveBeenCalledWith('class_id', 'name instructor categories');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Schedule not found' });
  });

  it('getScheduleById: returns 200 when found', async () => {
    const scheduleDoc = { _id: 'sc1' };
    const populate = jest.fn().mockResolvedValue(scheduleDoc);
    (ClassScheduleModel.findById as jest.Mock).mockReturnValue({ populate });

    await controller.getScheduleById({ params: { id: 'sc1' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: scheduleDoc });
  });

  it('getScheduleById: returns 500 on failure', async () => {
    const populate = jest.fn().mockRejectedValue(new Error('db fail'));
    (ClassScheduleModel.findById as jest.Mock).mockReturnValue({ populate });

    await controller.getScheduleById({ params: { id: 'sc1' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Error fetching schedule',
        error: 'db fail',
      })
    );
  });

  it('createSchedule: returns 201 and populates class info', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const populate = jest.fn().mockResolvedValue(undefined);
    (ClassScheduleModel as unknown as jest.Mock).mockImplementation(() => ({ save, populate }));

    const req: any = { body: { class_id: 'c1', date: new Date('2026-01-01') } };
    await controller.createSchedule(req, res);

    expect(ClassScheduleModel).toHaveBeenCalledWith(req.body);
    expect(save).toHaveBeenCalled();
    expect(populate).toHaveBeenCalledWith('class_id', 'name instructor categories');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Class schedule created successfully',
      })
    );
  });

  it('createSchedule: returns 400 on validation error', async () => {
    const save = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('bad schedule'), { name: 'ValidationError' }));
    const populate = jest.fn();
    (ClassScheduleModel as unknown as jest.Mock).mockImplementation(() => ({ save, populate }));

    await controller.createSchedule({ body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Validation error',
        error: 'bad schedule',
      })
    );
    expect(populate).not.toHaveBeenCalled();
  });

  it('updateSchedule: returns 404 when schedule missing', async () => {
    (ClassScheduleModel.findById as jest.Mock).mockResolvedValue(null);

    await controller.updateSchedule({ params: { id: 'missing' }, body: {} } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Schedule not found' });
  });

  it('updateSchedule: updates status/sessions and returns verified schedule', async () => {
    const markModified = jest.fn();
    const save = jest.fn().mockResolvedValue(undefined);
    const scheduleDoc: any = {
      sessions: [{ date: '2026-01-01', instructor: 'i1', status: 'scheduled' }],
      markModified,
      save,
    };

    const verifiedDoc = {
      _id: 'sc1',
      sessions: [{ date: '2026-01-01', instructor: 'i2', status: 'completed' }],
    };

    const populate = jest.fn().mockResolvedValue(verifiedDoc);
    const lean = jest.fn(() => ({ populate }));

    (ClassScheduleModel.findById as jest.Mock)
      .mockResolvedValueOnce(scheduleDoc)
      .mockReturnValueOnce({ lean });

    const req: any = {
      params: { id: 'sc1' },
      body: {
        status: 'completed',
        sessions: [{ date: '2026-01-01', instructor: 'i2', status: 'completed' }],
      },
    };

    await controller.updateSchedule(req, res);

    expect(scheduleDoc.status).toBe('completed');
    expect(scheduleDoc.sessions).toEqual(req.body.sessions);
    expect(markModified).toHaveBeenCalledWith('sessions');
    expect(save).toHaveBeenCalled();
    expect(lean).toHaveBeenCalled();
    expect(populate).toHaveBeenCalledWith('class_id', 'name instructor categories');

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Schedule updated successfully',
        data: verifiedDoc,
      })
    );
  });

  it('updateSchedule: returns 500 on failure and logs error', async () => {
    (ClassScheduleModel.findById as jest.Mock).mockRejectedValue(new Error('boom'));

    await controller.updateSchedule({ params: { id: 'sc1' }, body: {} } as any, res);

    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Error updating schedule',
        error: 'boom',
      })
    );
  });

  it('deleteSchedule: returns 404 when schedule missing', async () => {
    (deletionService.deleteScheduleCascade as jest.Mock).mockResolvedValue({ deletedSchedule: null });

    await controller.deleteSchedule({ params: { id: 'missing' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Schedule not found' });
  });

  it('deleteSchedule: returns 200 when deletion succeeds', async () => {
    const deletedSchedule = { _id: 'sc1' };
    (deletionService.deleteScheduleCascade as jest.Mock).mockResolvedValue({ deletedSchedule });

    await controller.deleteSchedule({ params: { id: 'sc1' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Schedule deleted successfully',
        data: deletedSchedule,
      })
    );
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
