import { StudentModel } from '../../models/Student';
import { StudentStatusEnum } from '../../types/interfaces';
import { StudentImportExportService } from '../../services/StudentImportExportService';

describe('StudentImportExportService', () => {
  const service = new StudentImportExportService();

  it('exports students as CSV with stable headers and sanitized values', async () => {
    await StudentModel.create({
      name: '=Dangerous Name',
      email: 'export@example.com',
      categories: ['kids', 'adult'],
      belt_level: '10kyu',
      phone: '070-123456',
      emergency_contact: {
        name: 'Parent',
        phone: '070-999999',
      },
      active: true,
      status: StudentStatusEnum.ACTIVE,
    });

    const csv = await service.exportStudentsCsv();

    const [header, dataRow] = csv.trim().split('\n');

    expect(header).toBe(
      'name,email,categories,belt_level,phone,emergency_contact_name,emergency_contact_phone,active,status'
    );
    expect(dataRow).toContain("'=Dangerous Name");
    expect(dataRow).toContain('kids|adult');
    expect(dataRow).toContain('export@example.com');
  });

  it('previews imports and reports row validation issues before any write', async () => {
    const csv = [
      'name,email,categories,belt_level,phone,emergency_contact_name,emergency_contact_phone,active,status',
      'Valid Student,valid@example.com,kids|adult,10kyu,070-111111,Parent,070-222222,true,active',
      'Invalid Category,invalid-category@example.com,unknown,10kyu,070-333333,Parent,070-444444,true,active',
      'Duplicate Email,valid@example.com,kids,10kyu,070-555555,Parent,070-666666,true,active',
      ',missing-name@example.com,kids,10kyu,070-777777,Parent,070-888888,true,active',
    ].join('\n');

    const preview = await service.previewImport(csv);

    expect(preview.summary.totalRows).toBe(4);
    expect(preview.summary.validRows).toBe(1);
    expect(preview.summary.invalidRows).toBe(3);
    expect(preview.rows[0]).toEqual(
      expect.objectContaining({
        rowNumber: 2,
        action: 'create',
        valid: true,
        normalizedStudent: expect.objectContaining({
          email: 'valid@example.com',
          categories: ['kids', 'adult'],
        }),
      })
    );
    expect(preview.rows[1].errors).toContain('Invalid category: unknown');
    expect(preview.rows[1].displayStudent).toEqual(
      expect.objectContaining({
        name: 'Invalid Category',
        email: 'invalid-category@example.com',
        categories: ['unknown'],
        belt_level: '10kyu',
      })
    );
    expect(preview.rows[2].errors).toContain('Duplicate email in file: valid@example.com');
    expect(preview.rows[3].errors).toContain('Name is required');
    expect(preview.rows[3].displayStudent).toEqual(
      expect.objectContaining({
        email: 'missing-name@example.com',
        categories: ['kids'],
        belt_level: '10kyu',
      })
    );
    expect(await StudentModel.countDocuments()).toBe(0);
  });

  it('applies imports by creating new students and updating existing students keyed by email', async () => {
    await StudentModel.create({
      name: 'Existing Student',
      email: 'existing@example.com',
      categories: ['kids'],
      belt_level: '10kyu',
      phone: '070-101010',
      emergency_contact: {
        name: 'Old Contact',
        phone: '070-202020',
      },
      active: true,
      status: StudentStatusEnum.ACTIVE,
    });

    const csv = [
      'name,email,categories,belt_level,phone,emergency_contact_name,emergency_contact_phone,active,status',
      'Existing Student Updated,existing@example.com,adult,9kyu,070-303030,New Contact,070-404040,false,inactive',
      'Brand New Student,new@example.com,kids|youth,10kyu,070-505050,Guardian,070-606060,true,active',
    ].join('\n');

    const result = await service.applyImport(csv);

    expect(result.summary.created).toBe(1);
    expect(result.summary.updated).toBe(1);
    expect(result.summary.skipped).toBe(0);
    expect(result.summary.invalidRows).toBe(0);

    const updatedStudent = await StudentModel.findOne({ email: 'existing@example.com' }).lean();
    const newStudent = await StudentModel.findOne({ email: 'new@example.com' }).lean();

    expect(updatedStudent).toEqual(
      expect.objectContaining({
        name: 'Existing Student Updated',
        categories: ['adult'],
        belt_level: '9kyu',
        phone: '070-303030',
        active: false,
        status: StudentStatusEnum.INACTIVE,
      })
    );
    expect(updatedStudent?.emergency_contact).toEqual({
      name: 'New Contact',
      phone: '070-404040',
    });

    expect(newStudent).toEqual(
      expect.objectContaining({
        name: 'Brand New Student',
        email: 'new@example.com',
        categories: ['kids', 'youth'],
      })
    );
  });

  it('accepts semicolon-delimited CSV imports', async () => {
    const csv = [
      'name;email;categories;belt_level;phone;emergency_contact_name;emergency_contact_phone;active;status',
      'Semicolon Student;semicolon@example.com;kids|adult;10kyu;070-999111;Guardian;070-999222;true;active',
    ].join('\n');

    const preview = await service.previewImport(csv);

    expect(preview.summary.totalRows).toBe(1);
    expect(preview.summary.validRows).toBe(1);
    expect(preview.summary.invalidRows).toBe(0);
    expect(preview.rows[0]).toEqual(
      expect.objectContaining({
        valid: true,
        action: 'create',
        normalizedStudent: expect.objectContaining({
          email: 'semicolon@example.com',
          categories: ['kids', 'adult'],
        }),
      })
    );
  });

  it('restores formula-sanitized phone numbers from exported CSV on import', async () => {
    const csv = [
      'name,email,categories,belt_level,phone,emergency_contact_name,emergency_contact_phone,active,status',
      "Test Student,test@example.com,advanced,10kyu,'+46700000,Parent,'+46700000001,true,active",
    ].join('\n');

    const preview = await service.previewImport(csv);

    expect(preview.rows[0]).toEqual(
      expect.objectContaining({
        valid: true,
        normalizedStudent: expect.objectContaining({
          phone: '+46700000',
          emergency_contact: expect.objectContaining({
            phone: '+46700000001',
          }),
        }),
        displayStudent: expect.objectContaining({
          name: 'Test Student',
          email: 'test@example.com',
        }),
      })
    );
  });

  it('accepts rows with a missing belt level as valid', async () => {
    const csv = [
      'name,email,categories,belt_level,phone,emergency_contact_name,emergency_contact_phone,active,status',
      'No Belt Student,no-belt@example.com,kids,,070-111222,Parent,070-333444,true,active',
    ].join('\n');

    const preview = await service.previewImport(csv);

    expect(preview.summary.validRows).toBe(1);
    expect(preview.rows[0].errors).not.toContain('Belt level is required');
    expect(preview.rows[0]).toEqual(
      expect.objectContaining({
        valid: true,
        normalizedStudent: expect.objectContaining({ belt_level: '' }),
      })
    );

    const result = await service.applyImport(csv);
    expect(result.summary.created).toBe(1);

    const created = await StudentModel.findOne({ email: 'no-belt@example.com' }).lean();
    expect(created?.belt_level).toBe('');
  });

  it('accepts categories regardless of letter casing', async () => {
    const csv = [
      'name,email,categories,belt_level,phone,emergency_contact_name,emergency_contact_phone,active,status',
      'Mixed Case,mixed-case@example.com,Kids|YOUTH,10kyu,070-111222,Parent,070-333444,true,active',
    ].join('\n');

    const preview = await service.previewImport(csv);

    expect(preview.summary.validRows).toBe(1);
    expect(preview.rows[0].errors).toHaveLength(0);
    expect(preview.rows[0].normalizedStudent?.categories).toEqual(['kids', 'youth']);
  });

  it('applies valid rows while skipping invalid rows and user-skipped rows', async () => {
    await StudentModel.create({
      name: 'Existing Student',
      email: 'existing@example.com',
      categories: ['kids'],
      belt_level: '10kyu',
      phone: '070-101010',
      emergency_contact: {
        name: 'Old Contact',
        phone: '070-202020',
      },
      active: true,
      status: StudentStatusEnum.ACTIVE,
    });

    const csv = [
      'name,email,categories,belt_level,phone,emergency_contact_name,emergency_contact_phone,active,status',
      'Existing Student Updated,existing@example.com,adult,9kyu,070-303030,New Contact,070-404040,false,inactive',
      'Brand New Student,new@example.com,kids|youth,10kyu,070-505050,Guardian,070-606060,true,active',
      'Broken Student,broken@example.com,unknown,10kyu,070-707070,Guardian,070-808080,true,active',
    ].join('\n');

    const result = await service.applyImport(csv, { 2: 'skip' });

    expect(result.summary.created).toBe(1);
    expect(result.summary.updated).toBe(0);
    expect(result.summary.skipped).toBe(2);
    expect(result.summary.invalidRows).toBe(1);
    expect(result.rows.find((row) => row.rowNumber === 2)?.action).toBe('skip');

    const existingStudent = await StudentModel.findOne({ email: 'existing@example.com' }).lean();
    const newStudent = await StudentModel.findOne({ email: 'new@example.com' }).lean();

    expect(existingStudent).toEqual(
      expect.objectContaining({
        name: 'Existing Student',
        categories: ['kids'],
      })
    );
    expect(newStudent).toEqual(
      expect.objectContaining({
        name: 'Brand New Student',
      })
    );
  });
});