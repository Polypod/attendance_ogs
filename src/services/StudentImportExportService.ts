import { StudentModel } from '../models/Student';
import { ConfigService } from './ConfigService';
import { detectCsvDelimiter, encodeCsvRow, parseCsv, restoreSanitizedCsvFormula } from '../utils/csv';
import { CreateStudentDto, StudentCategoryEnum, StudentStatusEnum, UpdateStudentDto } from '../types/interfaces';

const STUDENT_EXPORT_HEADERS = [
  'name',
  'email',
  'categories',
  'belt_level',
  'phone',
  'emergency_contact_name',
  'emergency_contact_phone',
  'active',
  'status',
] as const;

type StudentExportHeader = (typeof STUDENT_EXPORT_HEADERS)[number];

type NormalizedStudentImport = CreateStudentDto & {
  active: boolean;
  status: StudentStatusEnum;
};

export interface StudentImportDisplayData {
  name?: string;
  email?: string;
  categories?: string[];
  belt_level?: string;
  active?: boolean | null;
  status?: string;
}

export type StudentImportAction = 'create' | 'update' | 'skip';

export type StudentImportActionOverrides = Partial<Record<number, StudentImportAction>>;

export interface StudentImportRowResult {
  rowNumber: number;
  valid: boolean;
  action: StudentImportAction;
  errors: string[];
  displayStudent: StudentImportDisplayData;
  normalizedStudent?: NormalizedStudentImport;
}

export interface StudentImportPreviewResult {
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
  rows: StudentImportRowResult[];
}

export interface StudentImportApplyResult extends StudentImportPreviewResult {
  summary: StudentImportPreviewResult['summary'] & {
    created: number;
    updated: number;
    skipped: number;
  };
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const normalizeValue = (value: string | undefined): string => {
  return restoreSanitizedCsvFormula(value ?? '').trim();
};

const splitCategories = (value: string): string[] => {
  return value
    .split('|')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
};

const parseBoolean = (value: string): boolean | null => {
  const normalized = normalizeValue(value).toLowerCase();
  if (!normalized) return true;

  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;

  return null;
};

const parseStatus = (value: string, active: boolean): StudentStatusEnum | null => {
  const normalized = normalizeValue(value).toLowerCase();
  if (!normalized) {
    return active ? StudentStatusEnum.ACTIVE : StudentStatusEnum.INACTIVE;
  }

  if (normalized === StudentStatusEnum.ACTIVE) return StudentStatusEnum.ACTIVE;
  if (normalized === StudentStatusEnum.INACTIVE) return StudentStatusEnum.INACTIVE;

  return null;
};

const buildRowRecord = (headers: readonly StudentExportHeader[], values: string[]): Record<StudentExportHeader, string> => {
  return headers.reduce((record, header, index) => {
    record[header] = values[index] ?? '';
    return record;
  }, {} as Record<StudentExportHeader, string>);
};

export class StudentImportExportService {
  async exportStudentsCsv(): Promise<string> {
    const students = await StudentModel.find({}).sort({ email: 1 }).lean();
    const rows = students.map((student) => {
      return encodeCsvRow([
        student.name,
        student.email,
        student.categories.join('|'),
        student.belt_level,
        student.phone,
        student.emergency_contact?.name,
        student.emergency_contact?.phone,
        student.active ?? true,
        student.status ?? StudentStatusEnum.ACTIVE,
      ]);
    });

    return [encodeCsvRow([...STUDENT_EXPORT_HEADERS]), ...rows].join('\n');
  }

  async previewImport(csvContent: string): Promise<StudentImportPreviewResult> {
    const rows = await this.buildRowResults(csvContent);

    return {
      summary: {
        totalRows: rows.length,
        validRows: rows.filter((row) => row.valid).length,
        invalidRows: rows.filter((row) => !row.valid).length,
      },
      rows,
    };
  }

  async applyImport(
    csvContent: string,
    actionOverrides: StudentImportActionOverrides = {}
  ): Promise<StudentImportApplyResult> {
    const preview = await this.previewImport(csvContent);
    const rows = preview.rows.map((row) => ({
      ...row,
      action: row.valid ? actionOverrides[row.rowNumber] ?? row.action : 'skip',
    }));
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      if (!row.valid || !row.normalizedStudent || row.action === 'skip') {
        skipped += 1;
        continue;
      }

      const existingStudent = await StudentModel.findOne({ email: row.normalizedStudent.email });
      const updateData: UpdateStudentDto & { status: StudentStatusEnum } = {
        name: row.normalizedStudent.name,
        categories: row.normalizedStudent.categories,
        belt_level: row.normalizedStudent.belt_level,
        phone: row.normalizedStudent.phone,
        emergency_contact: row.normalizedStudent.emergency_contact,
        active: row.normalizedStudent.active,
        status: row.normalizedStudent.status,
      };

      if (row.action === 'update') {
        if (!existingStudent) {
          skipped += 1;
          continue;
        }

        await StudentModel.updateOne({ _id: existingStudent._id }, { $set: updateData });
        updated += 1;
        continue;
      }

      if (existingStudent) {
        skipped += 1;
        continue;
      }

      await StudentModel.create({
        ...row.normalizedStudent,
      });
      created += 1;
    }

    return {
      ...preview,
      rows,
      summary: {
        ...preview.summary,
        created,
        updated,
        skipped,
      },
    };
  }

  private async buildRowResults(csvContent: string): Promise<StudentImportRowResult[]> {
    const delimiter = detectCsvDelimiter(csvContent);
    const parsedRows = parseCsv(csvContent, delimiter);
    if (parsedRows.length === 0) {
      return [];
    }

    const [headerRow, ...dataRows] = parsedRows;
    const normalizedHeaderRow = headerRow.map((value) => normalizeValue(value));
    const hasExpectedHeaders =
      normalizedHeaderRow.length === STUDENT_EXPORT_HEADERS.length &&
      STUDENT_EXPORT_HEADERS.every((header, index) => normalizedHeaderRow[index] === header);

    if (!hasExpectedHeaders) {
      throw new Error(`Invalid student import headers. Expected: ${STUDENT_EXPORT_HEADERS.join(',')}`);
    }

    const rowRecords = dataRows.map((row) => buildRowRecord(STUDENT_EXPORT_HEADERS, row));
    const emails = rowRecords
      .map((row) => normalizeValue(row.email).toLowerCase())
      .filter(Boolean);
    const existingStudents = await StudentModel.find({ email: { $in: emails } }, { email: 1 }).lean();
    const existingEmails = new Set(existingStudents.map((student) => student.email.toLowerCase()));
    const seenEmails = new Set<string>();
    const configService = ConfigService.getInstance();

    return rowRecords.map((row, index) => {
      const rowNumber = index + 2;
      const errors: string[] = [];
      const name = normalizeValue(row.name);
      const email = normalizeValue(row.email).toLowerCase();
      const categories = splitCategories(row.categories);
      const beltLevel = normalizeValue(row.belt_level);
      const phone = normalizeValue(row.phone);
      const emergencyContactName = normalizeValue(row.emergency_contact_name);
      const emergencyContactPhone = normalizeValue(row.emergency_contact_phone);
      const active = parseBoolean(row.active);

      if (!name) {
        errors.push('Name is required');
      }

      if (!email) {
        errors.push('Email is required');
      } else if (!EMAIL_PATTERN.test(email)) {
        errors.push(`Invalid email: ${email}`);
      }

      if (email) {
        if (seenEmails.has(email)) {
          errors.push(`Duplicate email in file: ${email}`);
        } else {
          seenEmails.add(email);
        }
      }

      if (categories.length === 0) {
        errors.push('At least one category is required');
      }

      for (const category of categories) {
        if (!configService.isValidCategory(category)) {
          errors.push(`Invalid category: ${category}`);
        }
      }

      if (beltLevel && !configService.isValidBeltLevel(beltLevel)) {
        errors.push(`Invalid belt level: ${beltLevel}`);
      }

      if (active === null) {
        errors.push(`Invalid active flag: ${row.active}`);
      }

      const normalizedStatus = parseStatus(row.status, active ?? true);
      if (normalizedStatus === null) {
        errors.push(`Invalid status: ${row.status}`);
      }

      const normalizedCategories = categories as StudentCategoryEnum[];
      const displayStudent: StudentImportDisplayData = {
        name: name || undefined,
        email: email || undefined,
        categories: categories.length > 0 ? categories : undefined,
        belt_level: beltLevel || undefined,
        active,
        status: normalizeValue(row.status) || undefined,
      };

      const normalizedStudent = errors.length === 0 ? {
        name,
        email,
        categories: normalizedCategories,
        belt_level: beltLevel,
        phone,
        emergency_contact: {
          name: emergencyContactName,
          phone: emergencyContactPhone,
        },
        active: active ?? true,
        status: normalizedStatus ?? StudentStatusEnum.ACTIVE,
      } : undefined;

      return {
        rowNumber,
        valid: errors.length === 0,
        action: normalizedStudent
          ? existingEmails.has(email)
            ? 'update'
            : 'create'
          : 'skip',
        errors,
        displayStudent,
        normalizedStudent,
      } satisfies StudentImportRowResult;
    });
  }
}