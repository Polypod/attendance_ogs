import { ClassController } from '../../controllers/ClassController';
import { ClassModel } from '../../models/Class';
import { deletionService } from '../../services/DeletionService';

jest.mock('../../models/Class', () => {
  const save = jest.fn();
  const ClassModelMock: any = jest.fn().mockImplementation(() => ({
    save,
  }));

  ClassModelMock.__save = save;
  ClassModelMock.find = jest.fn();
  ClassModelMock.findById = jest.fn();
  ClassModelMock.findByIdAndUpdate = jest.fn();

  return {
    ClassModel: ClassModelMock,
  };
});

jest.mock('../../services/DeletionService', () => ({
  deletionService: {
    deleteClassCascade: jest.fn(),
  },
}));

describe('ClassController', () => {
  const controller = new ClassController();

  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAllClasses: returns classes on success', async () => {
    (ClassModel.find as jest.Mock).mockResolvedValue([{ _id: 'c1' }]);

    await controller.getAllClasses({} as any, res);

    expect(ClassModel.find).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ _id: 'c1' }] });
  });

  it('getClassById: returns 404 when not found', async () => {
    (ClassModel.findById as jest.Mock).mockResolvedValue(null);

    await controller.getClassById({ params: { id: 'missing' } } as any, res);

    expect(ClassModel.findById).toHaveBeenCalledWith('missing');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Class not found' });
  });

  it('createClass: returns 201 when created', async () => {
    const save = (ClassModel as any).__save as jest.Mock;
    save.mockResolvedValue(true);

    const req: any = { body: { name: 'Test', categories: ['barn'] } };
    await controller.createClass(req, res);

    expect(ClassModel).toHaveBeenCalledWith(req.body);
    expect(save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Class created successfully',
      })
    );
  });

  it('createClass: returns 400 on validation error', async () => {
    const save = (ClassModel as any).__save as jest.Mock;
    save.mockRejectedValue({ name: 'ValidationError', message: 'bad' });

    await controller.createClass({ body: { name: '' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation error',
      error: 'bad',
    });
  });

  it('deleteClass: returns 404 when not found', async () => {
    (deletionService.deleteClassCascade as jest.Mock).mockResolvedValue({ deletedClass: null });

    await controller.deleteClass({ params: { id: 'missing' } } as any, res);

    expect(deletionService.deleteClassCascade).toHaveBeenCalledWith('missing');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Class not found' });
  });

  it('deleteClass: returns 200 when deleted', async () => {
    (deletionService.deleteClassCascade as jest.Mock).mockResolvedValue({ deletedClass: { _id: 'c1' } });

    await controller.deleteClass({ params: { id: 'c1' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Class deleted successfully',
        data: { _id: 'c1' },
      })
    );
  });
});
