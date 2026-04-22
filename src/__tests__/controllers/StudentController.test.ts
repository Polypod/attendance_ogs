import { StudentController } from '../../controllers/StudentController';
import { StudentModel } from '../../models/Student';

jest.mock('../../models/Student', () => {
  const save = jest.fn();
  const StudentModelMock: any = jest.fn().mockImplementation(() => ({
    save,
  }));

  StudentModelMock.__save = save;
  StudentModelMock.find = jest.fn();
  StudentModelMock.findByIdAndUpdate = jest.fn();
  StudentModelMock.findByIdAndDelete = jest.fn();

  return {
    StudentModel: StudentModelMock,
  };
});

describe('StudentController', () => {
  const controller = new StudentController();

  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createStudent: returns 400 on duplicate email (11000)', async () => {
    const save = (StudentModel as any).__save as jest.Mock;
    save.mockRejectedValue({ code: 11000, message: 'dup' });

    await controller.createStudent({ body: { email: 'a@b.com' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Email already exists',
      error: 'Duplicate key error',
    });
  });

  it('updateStudent: builds $set and $unset from null fields', async () => {
    (StudentModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({ _id: 's1' });

    const req: any = {
      params: { id: 's1' },
      body: { first_name: null, last_name: 'Doe' },
    };

    await controller.updateStudent(req, res);

    expect(StudentModel.findByIdAndUpdate).toHaveBeenCalledWith(
      's1',
      {
        $set: { last_name: 'Doe' },
        $unset: { first_name: '' },
      },
      { new: true, runValidators: true }
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Student updated successfully',
      })
    );
  });

  it('updateStudent: removes empty $set when all fields are null', async () => {
    (StudentModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({ _id: 's1' });

    const req: any = {
      params: { id: 's1' },
      body: { emergency_contact: null },
    };

    await controller.updateStudent(req, res);

    expect(StudentModel.findByIdAndUpdate).toHaveBeenCalledWith(
      's1',
      {
        $unset: { emergency_contact: '' },
      },
      { new: true, runValidators: true }
    );
  });

  it('deleteStudent: returns 404 when not found', async () => {
    (StudentModel.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

    await controller.deleteStudent({ params: { id: 'missing' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Student not found' });
  });
});
