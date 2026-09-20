// src/services/MemberSyncService.ts - Sync students from the OGS member register
//
// The member register (OGS/PayloadCMS) is the source of truth. This service
// pulls its export and mirrors it onto Student documents. It never deletes:
// a member who leaves or is deactivated becomes an inactive student so that
// attendance history stays intact.
//
// Students without an external_id were created locally and are never touched.

import { StudentModel } from '../models/Student';
import { MemberSyncRunModel } from '../models/MemberSyncRun';
import { ConfigService } from './ConfigService';
import { StudentCategoryEnum, StudentStatusEnum } from '../types/interfaces';
import { MemberSyncConfig } from '../types/config';
import { logger } from '../utils/logger';

const EXTERNAL_SOURCE = 'payload';
const DEFAULT_TIMEOUT_MS = 30_000;

export interface OgsMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  email: string;
  phone: string | null;
  category: string | null;
  categoryId: string | null;
  grade: string | null;
  status: string | null;
  isActive: boolean;
  active: boolean;
  registrationDate: string | null;
  updatedAt: string | null;
}

export interface OgsMemberExport {
  generatedAt: string;
  count: number;
  activeCount: number;
  members: OgsMember[];
}

export type MemberSyncAction =
  | 'create'
  | 'update'
  | 'deactivate'
  | 'unchanged'
  | 'skip'
  | 'failed';

export interface MemberSyncRow {
  externalId: string | null;
  email: string;
  name: string;
  action: MemberSyncAction;
  /** Why the row was skipped or what needs a human decision. */
  reason?: string;
  /** Field-level diff, so a dry run shows exactly what would change. */
  changes: Record<string, { from: unknown; to: unknown }>;
  warnings: string[];
  errors: string[];
}

export interface MemberSyncSummary {
  total: number;
  created: number;
  updated: number;
  deactivated: number;
  unchanged: number;
  skipped: number;
  failed: number;
}

export interface MemberSyncResult {
  dryRun: boolean;
  sourceGeneratedAt: string | null;
  summary: MemberSyncSummary;
  rows: MemberSyncRow[];
  /** Subset of rows a human has to act on, surfaced separately for the UI. */
  attention: MemberSyncRow[];
}

type StudentFields = {
  name: string;
  email: string;
  phone: string;
  categories: StudentCategoryEnum[];
  belt_level?: string;
  active: boolean;
  status: StudentStatusEnum;
};

export type MemberExportFetcher = () => Promise<OgsMemberExport>;

/**
 * Fetch the export from OGS using the service account's Payload API key.
 */
export const fetchOgsMemberExport: MemberExportFetcher = async () => {
  const url = process.env.OGS_SYNC_URL?.trim();
  const apiKey = process.env.OGS_SYNC_API_KEY?.trim();

  if (!url) {
    throw new Error('OGS_SYNC_URL is not configured');
  }
  if (!apiKey) {
    throw new Error('OGS_SYNC_API_KEY is not configured');
  }

  const timeoutMs = Number(process.env.OGS_SYNC_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      // Payload's API key scheme: the collection slug prefixes the key.
      Authorization: `users API-Key ${apiKey}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Member export request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Partial<OgsMemberExport>;
  if (!Array.isArray(payload?.members)) {
    throw new Error('Member export response did not contain a members array');
  }

  return {
    generatedAt: payload.generatedAt ?? new Date().toISOString(),
    count: payload.count ?? payload.members.length,
    activeCount: payload.activeCount ?? 0,
    members: payload.members,
  };
};

const emptySummary = (): MemberSyncSummary => ({
  total: 0,
  created: 0,
  updated: 0,
  deactivated: 0,
  unchanged: 0,
  skipped: 0,
  failed: 0,
});

const normalizeEmail = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase();

const normalizeText = (value: string | null | undefined): string => (value ?? '').trim();

export class MemberSyncService {
  constructor(private readonly fetchExport: MemberExportFetcher = fetchOgsMemberExport) {}

  async preview(): Promise<MemberSyncResult> {
    return this.run({ dryRun: true, triggeredBy: 'preview' });
  }

  async apply(triggeredBy = 'manual'): Promise<MemberSyncResult> {
    return this.run({ dryRun: false, triggeredBy });
  }

  async run({
    dryRun,
    triggeredBy,
  }: {
    dryRun: boolean;
    triggeredBy: string;
  }): Promise<MemberSyncResult> {
    const startedAt = new Date();
    const syncConfig = ConfigService.getInstance().getMemberSyncConfig();

    let result: MemberSyncResult;
    try {
      const memberExport = await this.fetchExport();
      result = await this.reconcile(memberExport, syncConfig, dryRun);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('member_sync_failed', { dryRun, triggeredBy, message });

      // A run that never produced rows is still recorded, otherwise a silently
      // failing nightly job looks identical to one that was never scheduled.
      await this.recordRun({
        startedAt,
        dryRun,
        triggeredBy,
        succeeded: false,
        sourceGeneratedAt: null,
        summary: emptySummary(),
        attention: [],
        errors: [message],
      });

      throw error;
    }

    await this.recordRun({
      startedAt,
      dryRun,
      triggeredBy,
      succeeded: result.summary.failed === 0,
      sourceGeneratedAt: result.sourceGeneratedAt,
      summary: result.summary,
      attention: result.attention.map((row) => `${row.email}: ${row.reason ?? 'needs review'}`),
      errors: result.rows.flatMap((row) => row.errors.map((err) => `${row.email}: ${err}`)),
    });

    logger.info('member_sync_completed', { dryRun, triggeredBy, ...result.summary });

    return result;
  }

  private async reconcile(
    memberExport: OgsMemberExport,
    syncConfig: MemberSyncConfig,
    dryRun: boolean
  ): Promise<MemberSyncResult> {
    const members = memberExport.members;
    const rows: MemberSyncRow[] = [];
    const summary = emptySummary();

    const emails = members.map((member) => normalizeEmail(member.email)).filter(Boolean);
    const externalIds = members.map((member) => member.id).filter(Boolean);

    const candidates = await StudentModel.find({
      $or: [
        { external_id: { $in: externalIds } },
        { email: { $in: emails } },
        { external_source: EXTERNAL_SOURCE },
      ],
    });

    const byExternalId = new Map<string, any>();
    const byEmail = new Map<string, any>();
    for (const student of candidates) {
      if (typeof student.external_id === 'string' && student.external_id) {
        byExternalId.set(student.external_id, student);
      }
      byEmail.set(normalizeEmail(student.email), student);
    }

    const seenExternalIds = new Set<string>();

    for (const member of members) {
      const row = await this.reconcileMember({
        member,
        syncConfig,
        byExternalId,
        byEmail,
        dryRun,
      });

      if (member.id) seenExternalIds.add(member.id);
      rows.push(row);
      summary.total += 1;
      this.countRow(summary, row.action);
    }

    if (syncConfig.deactivate_missing) {
      const missingRows = await this.deactivateMissing({
        candidates,
        seenExternalIds,
        dryRun,
      });
      for (const row of missingRows) {
        rows.push(row);
        summary.total += 1;
        this.countRow(summary, row.action);
      }
    }

    return {
      dryRun,
      sourceGeneratedAt: memberExport.generatedAt ?? null,
      summary,
      rows,
      attention: rows.filter((row) => row.errors.length > 0 || Boolean(row.reason)),
    };
  }

  private countRow(summary: MemberSyncSummary, action: MemberSyncAction): void {
    switch (action) {
      case 'create':
        summary.created += 1;
        break;
      case 'update':
        summary.updated += 1;
        break;
      case 'deactivate':
        summary.deactivated += 1;
        break;
      case 'unchanged':
        summary.unchanged += 1;
        break;
      case 'failed':
        summary.failed += 1;
        break;
      default:
        summary.skipped += 1;
    }
  }

  private async reconcileMember({
    member,
    syncConfig,
    byExternalId,
    byEmail,
    dryRun,
  }: {
    member: OgsMember;
    syncConfig: MemberSyncConfig;
    byExternalId: Map<string, any>;
    byEmail: Map<string, any>;
    dryRun: boolean;
  }): Promise<MemberSyncRow> {
    const email = normalizeEmail(member.email);
    const name = normalizeText(member.displayName) || email;
    const warnings: string[] = [];

    const row: MemberSyncRow = {
      externalId: member.id || null,
      email,
      name,
      action: 'skip',
      changes: {},
      warnings,
      errors: [],
    };

    if (!member.id) {
      row.reason = 'Member has no id in the member register';
      return row;
    }
    if (!email) {
      row.reason = 'Member has no email address in the member register';
      return row;
    }

    const existing = byExternalId.get(member.id) ?? byEmail.get(email);

    // An email match on a student already bound to a different member means two
    // OGS members share an address. Guessing which one owns the record would
    // silently overwrite the other, so it is reported instead.
    if (
      existing &&
      typeof existing.external_id === 'string' &&
      existing.external_id &&
      existing.external_id !== member.id
    ) {
      row.action = 'failed';
      row.errors.push(
        `Email address already belongs to another synced member (${existing.external_id})`
      );
      return row;
    }

    const categories = this.resolveCategories(member, syncConfig, row);
    if (!categories) {
      return row;
    }

    const belt = this.resolveBeltLevel(member, syncConfig, warnings);

    const desired: StudentFields = {
      name,
      email,
      phone: normalizeText(member.phone),
      categories,
      active: member.active,
      status: member.active ? StudentStatusEnum.ACTIVE : StudentStatusEnum.INACTIVE,
    };
    if (belt.apply) {
      desired.belt_level = belt.value;
    }

    if (!existing) {
      // Inactive members are not provisioned. They have no attendance history
      // here, so creating them would only add noise to class rosters.
      if (!member.active) {
        row.reason = 'Inactive member that does not already exist here';
        return row;
      }

      row.action = 'create';
      for (const [field, value] of Object.entries(desired)) {
        row.changes[field] = { from: undefined, to: value };
      }

      if (!dryRun) {
        try {
          await StudentModel.create({
            ...desired,
            external_source: EXTERNAL_SOURCE,
            external_id: member.id,
            last_synced_at: new Date(),
            // Only seeded at creation; afterwards the local value is kept so a
            // re-registration in OGS does not rewrite attendance history.
            ...(member.registrationDate
              ? { registration_date: new Date(member.registrationDate) }
              : {}),
          });
        } catch (error) {
          row.action = 'failed';
          row.errors.push(this.describeWriteError(error));
        }
      }

      return row;
    }

    const changes = this.diff(existing, desired);
    const adoptsExternalId = !existing.external_id;

    if (Object.keys(changes).length === 0 && !adoptsExternalId) {
      row.action = 'unchanged';
      if (!dryRun) {
        await StudentModel.updateOne(
          { _id: existing._id },
          { $set: { last_synced_at: new Date() } }
        );
      }
      return row;
    }

    row.changes = changes;
    // Reported separately from a plain update so the UI can show how many
    // members left the register rather than burying it in the update count.
    row.action = changes.active?.to === false ? 'deactivate' : 'update';

    if (adoptsExternalId) {
      warnings.push('Linked to the member register by email address');
    }

    if (!dryRun) {
      try {
        await StudentModel.updateOne(
          { _id: existing._id },
          {
            $set: {
              ...desired,
              external_source: EXTERNAL_SOURCE,
              external_id: member.id,
              last_synced_at: new Date(),
            },
          },
          { runValidators: true }
        );
      } catch (error) {
        row.action = 'failed';
        row.errors.push(this.describeWriteError(error));
      }
    }

    return row;
  }

  /**
   * Map the OGS member category onto local categories.
   *
   * Returns null when the member cannot be synced, having set the reason on the
   * row. A student requires at least one category, so an unmapped member is not
   * something the sync can paper over.
   */
  private resolveCategories(
    member: OgsMember,
    syncConfig: MemberSyncConfig,
    row: MemberSyncRow
  ): StudentCategoryEnum[] | null {
    const sourceCategory = normalizeText(member.category);
    const mapped = sourceCategory ? syncConfig.category_map[sourceCategory] : undefined;

    if (mapped && mapped.length > 0) {
      return [...mapped] as StudentCategoryEnum[];
    }

    if (syncConfig.unmapped_category_action === 'default') {
      if (syncConfig.default_categories.length > 0) {
        row.warnings.push(
          sourceCategory
            ? `Unmapped category "${sourceCategory}", falling back to the default category`
            : 'No category in the member register, falling back to the default category'
        );
        return [...syncConfig.default_categories] as StudentCategoryEnum[];
      }
      row.reason = 'No default category is configured';
      return null;
    }

    if (syncConfig.unmapped_category_action === 'skip') {
      return null;
    }

    row.reason = sourceCategory
      ? `Category "${sourceCategory}" has no mapping in member_sync.category_map`
      : 'Member has no category in the member register';
    return null;
  }

  /**
   * Map the OGS grade onto a local belt level.
   *
   * An unknown grade leaves the belt untouched rather than clearing it: that is
   * a gap in the mapping table, not an instruction to wipe the value.
   */
  private resolveBeltLevel(
    member: OgsMember,
    syncConfig: MemberSyncConfig,
    warnings: string[]
  ): { apply: boolean; value: string } {
    const grade = normalizeText(member.grade);

    if (!grade) {
      return { apply: true, value: '' };
    }

    if (!(grade in syncConfig.belt_map)) {
      warnings.push(`Grade "${grade}" has no mapping in member_sync.belt_map`);
      return { apply: false, value: '' };
    }

    return { apply: true, value: syncConfig.belt_map[grade] ?? '' };
  }

  private diff(existing: any, desired: StudentFields): MemberSyncRow['changes'] {
    const changes: MemberSyncRow['changes'] = {};

    for (const [field, value] of Object.entries(desired)) {
      const current = existing[field];

      if (Array.isArray(value)) {
        const currentArray: string[] = Array.isArray(current) ? [...current].sort() : [];
        const desiredArray = [...value].sort();
        if (currentArray.join('|') !== desiredArray.join('|')) {
          changes[field] = { from: current ?? [], to: value };
        }
        continue;
      }

      // Mongoose returns undefined for unset optional strings; treat that as ''
      // so an absent phone number does not read as a change on every run.
      const normalizedCurrent = typeof value === 'string' ? (current ?? '') : current;
      if (normalizedCurrent !== value) {
        changes[field] = { from: current, to: value };
      }
    }

    return changes;
  }

  /**
   * Deactivate students whose member is gone from the export entirely.
   *
   * Members who merely turned inactive still appear in the export and are
   * handled by the normal update path; this covers hard deletions in OGS.
   */
  private async deactivateMissing({
    candidates,
    seenExternalIds,
    dryRun,
  }: {
    candidates: any[];
    seenExternalIds: Set<string>;
    dryRun: boolean;
  }): Promise<MemberSyncRow[]> {
    const rows: MemberSyncRow[] = [];

    for (const student of candidates) {
      const externalId = typeof student.external_id === 'string' ? student.external_id : '';
      if (!externalId || seenExternalIds.has(externalId)) continue;
      if (student.active === false) continue;

      const row: MemberSyncRow = {
        externalId,
        email: normalizeEmail(student.email),
        name: student.name,
        action: 'deactivate',
        reason: 'Member is no longer in the member register',
        changes: {
          active: { from: student.active, to: false },
          status: { from: student.status, to: StudentStatusEnum.INACTIVE },
        },
        warnings: [],
        errors: [],
      };

      if (!dryRun) {
        try {
          await StudentModel.updateOne(
            { _id: student._id },
            {
              $set: {
                active: false,
                status: StudentStatusEnum.INACTIVE,
                last_synced_at: new Date(),
              },
            }
          );
        } catch (error) {
          row.action = 'failed';
          row.errors.push(this.describeWriteError(error));
        }
      }

      rows.push(row);
    }

    return rows;
  }

  private describeWriteError(error: unknown): string {
    if (error && typeof error === 'object' && (error as { code?: number }).code === 11000) {
      return 'Email address is already used by another student here';
    }
    if (error && typeof error === 'object' && (error as { name?: string }).name === 'ValidationError') {
      return `Validation error: ${(error as Error).message}`;
    }
    return error instanceof Error ? error.message : String(error);
  }

  private async recordRun(run: {
    startedAt: Date;
    dryRun: boolean;
    triggeredBy: string;
    succeeded: boolean;
    sourceGeneratedAt: string | null;
    summary: MemberSyncSummary;
    attention: string[];
    errors: string[];
  }): Promise<void> {
    try {
      await MemberSyncRunModel.create({
        started_at: run.startedAt,
        finished_at: new Date(),
        dry_run: run.dryRun,
        succeeded: run.succeeded,
        triggered_by: run.triggeredBy,
        source_generated_at: run.sourceGeneratedAt ? new Date(run.sourceGeneratedAt) : undefined,
        summary: run.summary,
        attention: run.attention,
        error_messages: run.errors,
      });
    } catch (error) {
      // The audit log must never take down a sync that otherwise succeeded.
      logger.warn('member_sync_run_log_failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
