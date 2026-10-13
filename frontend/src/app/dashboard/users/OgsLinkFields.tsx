"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getOgsGrantedRole, OgsLink, OgsStaffAccount } from "./userHelpers";

const NOT_LINKED = "__none__";

type Props = {
  idPrefix: string;
  value: OgsLink;
  onChange: (value: OgsLink) => void;
  accounts: OgsStaffAccount[] | null;
  accountsError: string | null;
};

/**
 * Link an attendance user to an OGS account and allow sign-in through OGS.
 * When the OGS account list cannot be loaded, the OGS user id can be typed.
 */
export function OgsLinkFields({ idPrefix, value, onChange, accounts, accountsError }: Props) {
  const linkedId = value.ogs_user_id.trim();
  const selected = accounts?.find((account) => account.id === linkedId) ?? null;
  const grantedRole = getOgsGrantedRole(selected);
  // Keep a linked id selectable even if OGS no longer lists the account.
  const missingFromList = Boolean(linkedId && accounts && !selected);

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <label htmlFor={`${idPrefix}-ogs-account`} className="block text-sm font-medium mb-1">
          OGS account
        </label>
        {accounts ? (
          <Select
            value={linkedId || NOT_LINKED}
            onValueChange={(next) =>
              onChange({
                ogs_user_id: next === NOT_LINKED ? "" : next,
                sso_enabled: next === NOT_LINKED ? false : value.sso_enabled,
              })
            }
          >
            <SelectTrigger id={`${idPrefix}-ogs-account`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NOT_LINKED}>Not linked</SelectItem>
              {missingFromList && (
                <SelectItem value={linkedId}>{linkedId} (not found in OGS)</SelectItem>
              )}
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.displayName} ({account.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id={`${idPrefix}-ogs-account`}
            value={value.ogs_user_id}
            onChange={(e) =>
              onChange({
                ogs_user_id: e.target.value,
                sso_enabled: e.target.value.trim() ? value.sso_enabled : false,
              })
            }
            placeholder="OGS user id"
          />
        )}
        {accountsError && (
          <p className="mt-1 text-xs text-muted-foreground">
            Could not load accounts from OGS ({accountsError}). Enter the OGS user id instead.
          </p>
        )}
        {selected && (
          <p className="mt-1 text-xs text-muted-foreground">
            {grantedRole
              ? `OGS grants the ${grantedRole} role in attendance.`
              : "OGS grants no access: the account lacks admin/editor or is not active."}
          </p>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          id={`${idPrefix}-sso-enabled`}
          type="checkbox"
          checked={Boolean(linkedId) && value.sso_enabled}
          disabled={!linkedId}
          onChange={(e) => onChange({ ...value, sso_enabled: e.target.checked })}
        />
        Allow sign-in through OGS
      </label>
    </div>
  );
}
