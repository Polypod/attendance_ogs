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

jest.mock('../../services/StudentImportExportService', () => {
  const mockStudentImportExportService = {
    exportStudentsCsv: jest.fn(),
    previewImport: jest.fn(),
    applyImport: jest.fn(),
  };

  return {
    StudentImportExportService: jest.fn().mockImplementation(() => mockStudentImportExportService),
    mockStudentImportExportService,
  };
});

describe('StudentController', () => {
  const controller = new StudentController();
  const { mockStudentImportExportService: studentImportExportServiceMock } = jest.requireMock('../../services/StudentImportExportService') as {
    mockStudentImportExportService: {
      exportStudentsCsv: jest.Mock;
      previewImport: jest.Mock;
      applyImport: jest.Mock;
    };
  };

  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
    setHeader: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exportStudentsCsv: streams CSV with attachment headers', async () => {
    studentImportExportServiceMock.exportStudentsCsv.mockResolvedValue('name,email\nJane,jane@example.com');

    await controller.exportStudentsCsv({} as any, res);

    expect(studentImportExportServiceMock.exportStudentsCsv).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename="students-')
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('name,email\nJane,jane@example.com');
  });

  it('previewStudentImport: returns preview payload from service', async () => {
    const preview = {
      summary: { totalRows: 1, validRows: 1, invalidRows: 0 },
      rows: [],
    };
    studentImportExportServiceMock.previewImport.mockResolvedValue(preview);

    await controller.previewStudentImport({ body: { csvContent: 'name,email' } } as any, res);

    expect(studentImportExportServiceMock.previewImport).toHaveBeenCalledWith('name,email');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Student import preview generated successfully',
      data: preview,
    });
  });

  it('applyStudentImport: returns 400 when service rejects import', async () => {
    studentImportExportServiceMock.applyImport.mockRejectedValue(new Error('Invalid student import headers'));

    await controller.applyStudentImport({ body: { csvContent: 'bad' } } as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Error applying student import',
      error: 'Invalid student import headers',
    });
  });

  it('applyStudentImport: forwards row action overrides to the service', async () => {
    const result = {
      summary: { totalRows: 1, validRows: 1, invalidRows: 0, created: 0, updated: 1, skipped: 0 },
      rows: [],
    };
    studentImportExportServiceMock.applyImport.mockResolvedValue(result);

    await controller.applyStudentImport(
      { body: { csvContent: 'name,email', actionOverrides: { 2: 'skip' } } } as any,
      res
    );

    expect(studentImportExportServiceMock.applyImport).toHaveBeenCalledWith('name,email', { 2: 'skip' });
    expect(res.status).toHaveBeenCalledWith(200);
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
