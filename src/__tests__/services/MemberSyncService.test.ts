import { StudentModel } from '../../models/Student';
import { MemberSyncRunModel } from '../../models/MemberSyncRun';
import { StudentCategoryEnum, StudentStatusEnum } from '../../types/interfaces';
import {
  MemberSyncResult,
  MemberSyncRow,
  MemberSyncService,
  OgsMember,
  OgsMemberExport,
} from '../../services/MemberSyncService';

const buildMember = (overrides: Partial<OgsMember> = {}): OgsMember => ({
  id: 'ogs-1',
  firstName: 'Anna',
  lastName: 'Andersson',
  displayName: 'Anna Andersson',
  email: 'anna@example.com',
  phone: '070-111 22 33',
  category: 'Kids',
  categoryId: 'cat-kids',
  grade: null,
  kyuDanGrade: null,
  status: 'approved',
  isActive: true,
  active: true,
  registrationDate: null,
  updatedAt: null,
  ...overrides,
});

const serviceFor = (...members: OgsMember[]): MemberSyncService => {
  const memberExport: OgsMemberExport = {
    generatedAt: '2026-09-20T03:00:00.000Z',
    count: members.length,
    activeCount: members.filter((member) => member.active).length,
    members,
  };

  return new MemberSyncService(async () => memberExport);
};

const rowFor = (result: MemberSyncResult, email: string): MemberSyncRow =>
  result.rows.find((row) => row.email === email)!;

describe('MemberSyncService', () => {
  it('creates active members with categories mapped from the register', async () => {
    const result = await serviceFor(buildMember()).apply();

    expect(result.summary.created).toBe(1);

    const student = await StudentModel.findOne({ email: 'anna@example.com' });
    expect(student).not.toBeNull();
    expect(student!.name).toBe('Anna Andersson');
    expect(student!.categories).toEqual(['barn']);
    expect(student!.phone).toBe('070-111 22 33');
    expect(student!.active).toBe(true);
    expect(student!.status).toBe(StudentStatusEnum.ACTIVE);
    expect(student!.external_id).toBe('ogs-1');
    expect(student!.external_source).toBe('payload');
    expect(student!.last_synced_at).toBeInstanceOf(Date);
  });

  it('maps the Instructor category onto the local instruktor category', async () => {
    await serviceFor(buildMember({ category: 'Instructor' })).apply();

    const student = await StudentModel.findOne({ email: 'anna@example.com' });
    expect(student!.categories).toEqual(['instruktor']);
  });

  it('skips members without a category and reports why', async () => {
    const result = await serviceFor(buildMember({ category: null })).apply();

    expect(result.summary.created).toBe(0);
    expect(result.summary.skipped).toBe(1);
    expect(rowFor(result, 'anna@example.com').reason).toMatch(/no category/i);
    expect(result.attention).toHaveLength(1);
    await expect(StudentModel.countDocuments({})).resolves.toBe(0);
  });

  it('does not create members that are inactive in the register', async () => {
    const result = await serviceFor(
      buildMember({ isActive: false, active: false })
    ).apply();

    expect(result.summary.created).toBe(0);
    expect(result.summary.skipped).toBe(1);
    await expect(StudentModel.countDocuments({})).resolves.toBe(0);
  });

  it('lets the register win on changed fields', async () => {
    await StudentModel.create({
      name: 'Gammalt Namn',
      email: 'anna@example.com',
      categories: [StudentCategoryEnum.ADULT],
      phone: '070-000 00 00',
      external_source: 'payload',
      external_id: 'ogs-1',
      active: true,
      status: StudentStatusEnum.ACTIVE,
    });

    const result = await serviceFor(buildMember()).apply();

    expect(result.summary.updated).toBe(1);

    const student = await StudentModel.findOne({ external_id: 'ogs-1' });
    expect(student!.name).toBe('Anna Andersson');
    expect(student!.categories).toEqual(['barn']);
    expect(student!.phone).toBe('070-111 22 33');
  });

  it('deactivates a member that turned inactive instead of deleting it', async () => {
    await StudentModel.create({
      name: 'Anna Andersson',
      email: 'anna@example.com',
      categories: [StudentCategoryEnum.KIDS],
      external_source: 'payload',
      external_id: 'ogs-1',
      active: true,
      status: StudentStatusEnum.ACTIVE,
    });

    const result = await serviceFor(
      buildMember({ isActive: false, active: false })
    ).apply();

    expect(result.summary.deactivated).toBe(1);

    const student = await StudentModel.findOne({ external_id: 'ogs-1' });
    expect(student).not.toBeNull();
    expect(student!.active).toBe(false);
    expect(student!.status).toBe(StudentStatusEnum.INACTIVE);
  });

  it('deactivates students whose member disappeared from the export', async () => {
    await StudentModel.create({
      name: 'Borttagen Medlem',
      email: 'borta@example.com',
      categories: [StudentCategoryEnum.ADULT],
      external_source: 'payload',
      external_id: 'ogs-gone',
      active: true,
      status: StudentStatusEnum.ACTIVE,
    });

    const result = await serviceFor(buildMember()).apply();

    expect(result.summary.deactivated).toBe(1);
    const student = await StudentModel.findOne({ external_id: 'ogs-gone' });
    expect(student!.active).toBe(false);
    expect(rowFor(result, 'borta@example.com').reason).toMatch(/no longer/i);
  });

  it('adopts a locally created student that matches on email', async () => {
    await StudentModel.create({
      name: 'Anna Andersson',
      email: 'anna@example.com',
      categories: [StudentCategoryEnum.ADULT],
      active: true,
      status: StudentStatusEnum.ACTIVE,
    });

    const result = await serviceFor(buildMember()).apply();

    await expect(StudentModel.countDocuments({})).resolves.toBe(1);
    const student = await StudentModel.findOne({ email: 'anna@example.com' });
    expect(student!.external_id).toBe('ogs-1');
    expect(student!.categories).toEqual(['barn']);
    expect(rowFor(result, 'anna@example.com').warnings).toContain(
      'Linked to the member register by email address'
    );
  });

  it('leaves locally created students that match no member alone', async () => {
    await StudentModel.create({
      name: 'Lokal Elev',
      email: 'lokal@example.com',
      categories: [StudentCategoryEnum.ADULT],
      belt_level: '8kyu',
      active: true,
      status: StudentStatusEnum.ACTIVE,
    });

    await serviceFor(buildMember()).apply();

    const student = await StudentModel.findOne({ email: 'lokal@example.com' });
    expect(student!.active).toBe(true);
    expect(student!.belt_level).toBe('8kyu');
    expect(student!.external_id).toBeUndefined();
  });

  it('maps a known grade onto a belt level and leaves an unknown grade untouched', async () => {
    const mapped = await serviceFor(buildMember({ grade: 'white' })).apply();
    expect(mapped.summary.created).toBe(1);
    const whiteBelt = await StudentModel.findOne({ external_id: 'ogs-1' });
    expect(whiteBelt!.belt_level).toBe('10kyu');

    const result = await serviceFor(buildMember({ grade: 'chartreuse' })).apply();
    const student = await StudentModel.findOne({ external_id: 'ogs-1' });
    expect(student!.belt_level).toBe('10kyu');
    expect(rowFor(result, 'anna@example.com').warnings.join(' ')).toMatch(/chartreuse/);
  });

  it('resolves a black belt from the dan number rather than the grade', async () => {
    // OGS has a single `black` grade option, so the dan lives in kyuDanGrade.
    await serviceFor(buildMember({ grade: 'black', kyuDanGrade: 3 })).apply();

    const student = await StudentModel.findOne({ external_id: 'ogs-1' });
    expect(student!.belt_level).toBe('black_3rd');
  });

  it.each([
    [1, 'black_1st'],
    [2, 'black_2nd'],
    [4, 'black_4th'],
    [5, 'black_5th'],
  ])('maps dan %i onto %s', async (dan, expected) => {
    await serviceFor(buildMember({ grade: 'black', kyuDanGrade: dan as number })).apply();

    const student = await StudentModel.findOne({ external_id: 'ogs-1' });
    expect(student!.belt_level).toBe(expected);
  });

  it('leaves the belt untouched when a black belt has no dan number', async () => {
    const result = await serviceFor(
      buildMember({ grade: 'black', kyuDanGrade: null })
    ).apply();

    const student = await StudentModel.findOne({ external_id: 'ogs-1' });
    // Falling back to the lowest dan is what made every black belt a 1st dan.
    expect(student!.belt_level).toBeUndefined();
    expect(rowFor(result, 'anna@example.com').warnings.join(' ')).toMatch(/Kyu\/Dan Grade/);
  });

  it('leaves the belt untouched when the dan number is outside the mapping', async () => {
    const result = await serviceFor(
      buildMember({ grade: 'black', kyuDanGrade: 9 })
    ).apply();

    const student = await StudentModel.findOne({ external_id: 'ogs-1' });
    expect(student!.belt_level).toBeUndefined();
    expect(rowFor(result, 'anna@example.com').warnings.join(' ')).toMatch(/Dan 9/);
  });

  it('does not corrupt an existing dan belt when the dan number goes missing', async () => {
    await serviceFor(buildMember({ grade: 'black', kyuDanGrade: 4 })).apply();
    await serviceFor(buildMember({ grade: 'black', kyuDanGrade: null })).apply();

    const student = await StudentModel.findOne({ external_id: 'ogs-1' });
    expect(student!.belt_level).toBe('black_4th');
  });

  it('reports an email already claimed by a different member instead of overwriting', async () => {
    await StudentModel.create({
      name: 'Annan Medlem',
      email: 'anna@example.com',
      categories: [StudentCategoryEnum.ADULT],
      external_source: 'payload',
      external_id: 'ogs-other',
      active: true,
      status: StudentStatusEnum.ACTIVE,
    });

    const result = await serviceFor(buildMember()).apply();

    expect(result.summary.failed).toBe(1);
    expect(rowFor(result, 'anna@example.com').errors.join(' ')).toMatch(/ogs-other/);
    const student = await StudentModel.findOne({ email: 'anna@example.com' });
    expect(student!.name).toBe('Annan Medlem');
  });

  it('is idempotent: a second run reports no changes', async () => {
    await serviceFor(buildMember()).apply();
    const second = await serviceFor(buildMember()).apply();

    expect(second.summary.created).toBe(0);
    expect(second.summary.updated).toBe(0);
    expect(second.summary.unchanged).toBe(1);
  });

  it('writes nothing during a dry run but still reports the planned actions', async () => {
    const result = await serviceFor(buildMember()).preview();

    expect(result.dryRun).toBe(true);
    expect(result.summary.created).toBe(1);
    expect(result.rows[0].changes.name).toEqual({ from: undefined, to: 'Anna Andersson' });
    await expect(StudentModel.countDocuments({})).resolves.toBe(0);
  });

  it('records every run, including failures, in the audit log', async () => {
    await serviceFor(buildMember()).apply();

    const failing = new MemberSyncService(async () => {
      throw new Error('OGS is unreachable');
    });
    await expect(failing.apply()).rejects.toThrow('OGS is unreachable');

    const runs = await MemberSyncRunModel.find({}).sort({ started_at: 1 });
    expect(runs).toHaveLength(2);
    expect(runs[0].succeeded).toBe(true);
    expect(runs[0].summary.created).toBe(1);
    expect(runs[1].succeeded).toBe(false);
    expect(runs[1].error_messages).toEqual(['OGS is unreachable']);
  });

  it('skips members the export could not identify', async () => {
    const result = await serviceFor(
      buildMember({ id: '' }),
      buildMember({ id: 'ogs-2', email: '  ' })
    ).apply();

    expect(result.summary.skipped).toBe(2);
    await expect(StudentModel.countDocuments({})).resolves.toBe(0);
  });
});
