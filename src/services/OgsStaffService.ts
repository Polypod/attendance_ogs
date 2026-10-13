// src/services/OgsStaffService.ts - Reads OGS admin/editor accounts for SSO
import { UserRoleEnum } from '../types/interfaces';

/**
 * An OGS account as returned by GET /api/attendance-sync/staff in OGS.
 * Only users holding the `admin` or `editor` role are exported there.
 */
export interface OgsStaffAccount {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  status: string | null;
  // null when OGS has no value; only `false` blocks access
  isActive: boolean | null;
}

export type OgsStaffFetcher = (id?: string) => Promise<OgsStaffAccount[]>;

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * The staff export lives next to the member export, so it defaults to the
 * member sync URL with `/members` replaced by `/staff`.
 */
export const resolveOgsStaffUrl = (): string | null => {
  const explicit = process.env.OGS_STAFF_URL?.trim();
  if (explicit) return explicit;

  const syncUrl = process.env.OGS_SYNC_URL?.trim();
  if (syncUrl && /\/members\/?$/.test(syncUrl)) {
    return syncUrl.replace(/\/members\/?$/, '/staff');
  }
  return null;
};

/**
 * Fetch OGS admin/editor accounts with the member sync service account's API key.
 * Passing an id returns at most that one account.
 */
export const fetchOgsStaff: OgsStaffFetcher = async (id) => {
  const baseUrl = resolveOgsStaffUrl();
  const apiKey = process.env.OGS_SYNC_API_KEY?.trim();

  if (!baseUrl) {
    throw new Error('OGS_STAFF_URL is not configured');
  }
  if (!apiKey) {
    throw new Error('OGS_SYNC_API_KEY is not configured');
  }

  const url = new URL(baseUrl);
  if (id) url.searchParams.set('id', id);

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
    throw new Error(`OGS staff request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { staff?: unknown };
  if (!Array.isArray(payload?.staff)) {
    throw new Error('OGS staff response did not contain a staff array');
  }

  return payload.staff as OgsStaffAccount[];
};

/**
 * The attendance role an OGS account is entitled to, or null when it may not
 * sign in: the account must be approved, not explicitly inactive, and hold
 * `admin` or `editor`. `admin` wins when both are present.
 */
export const resolveAttendanceRole = (
  account: OgsStaffAccount | null | undefined
): UserRoleEnum.ADMIN | UserRoleEnum.EDITOR | null => {
  if (!account) return null;
  if (account.status !== 'approved') return null;
  if (account.isActive === false) return null;

  const roles = Array.isArray(account.roles) ? account.roles : [];
  if (roles.includes('admin')) return UserRoleEnum.ADMIN;
  if (roles.includes('editor')) return UserRoleEnum.EDITOR;
  return null;
};

export class OgsStaffService {
  constructor(private readonly fetchStaff: OgsStaffFetcher = fetchOgsStaff) {}

  async list(): Promise<OgsStaffAccount[]> {
    return this.fetchStaff();
  }

  async findById(id: string): Promise<OgsStaffAccount | null> {
    const accounts = await this.fetchStaff(id);
    return accounts.find((account) => String(account.id) === id) ?? null;
  }
}

export const ogsStaffService = new OgsStaffService();
