"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SyncAction = "create" | "update" | "deactivate" | "unchanged" | "skip" | "failed";

type SyncRow = {
  externalId: string | null;
  email: string;
  name: string;
  action: SyncAction;
  reason?: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  warnings: string[];
  errors: string[];
};

type SyncSummary = {
  total: number;
  created: number;
  updated: number;
  deactivated: number;
  unchanged: number;
  skipped: number;
  failed: number;
};

type SyncResult = {
  dryRun: boolean;
  sourceGeneratedAt: string | null;
  summary: SyncSummary;
  rows: SyncRow[];
  attention: SyncRow[];
};

type SyncRun = {
  started_at: string;
  finished_at?: string;
  dry_run: boolean;
  succeeded: boolean;
  triggered_by: string;
  summary: SyncSummary;
  error_messages: string[];
};

type SyncStatus = {
  configured: boolean;
  lastRun: SyncRun | null;
  recentRuns: SyncRun[];
};

type ApiPayload<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
};

const ACTION_LABELS: Record<SyncAction, string> = {
  create: "Create",
  update: "Update",
  deactivate: "Deactivate",
  unchanged: "Unchanged",
  skip: "Skipped",
  failed: "Failed",
};

const formatTimestamp = (value: string | null | undefined): string => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const formatChange = (value: unknown): string => {
  if (value === undefined) return "(not set)";
  if (value === null) return "(none)";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "(none)";
  if (value === "") return "(empty)";
  return String(value);
};

const summarizeChanges = (changes: SyncRow["changes"]): string => {
  const entries = Object.entries(changes);
  if (entries.length === 0) return "-";

  return entries
    .map(([field, { from, to }]) => `${field}: ${formatChange(from)} → ${formatChange(to)}`)
    .join("; ");
};

export default function MemberSyncSettings() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [busyAction, setBusyAction] = useState<"preview" | "run" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/frontend-api/sync/members/status", { cache: "no-store" });
      const payload: ApiPayload<SyncStatus> = await response.json();

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? payload.message ?? "Could not load sync status");
      }

      setStatus(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sync status");
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const callSync = async (action: "preview" | "run") => {
    setBusyAction(action);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/frontend-api/sync/members/${action}`, { method: "POST" });
      const payload: ApiPayload<SyncResult> = await response.json();

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? payload.message ?? "The member sync failed");
      }

      setResult(payload.data);
      setMessage(
        action === "preview"
          ? "Preview generated. Nothing has been written yet."
          : "Member sync applied.",
      );

      if (action === "run") {
        await loadStatus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The member sync failed");
    } finally {
      setBusyAction(null);
    }
  };

  const lastRun = status?.lastRun ?? null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Member register sync</CardTitle>
          <CardDescription>
            Pull members from the OGS member register. The register is the source of truth for
            name, email, phone, category, belt level, and active status. Members who leave are
            deactivated here rather than deleted, so attendance history is kept. Students created
            manually here are never touched.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status && !status.configured && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              The sync source is not configured. Set OGS_SYNC_URL and OGS_SYNC_API_KEY on the
              backend before running it.
            </p>
          )}

          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Last run</dt>
              <dd className="font-medium">{formatTimestamp(lastRun?.started_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Triggered by</dt>
              <dd className="font-medium">{lastRun?.triggered_by ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Outcome</dt>
              <dd className="font-medium">
                {lastRun ? (lastRun.succeeded ? "Succeeded" : "Failed") : "-"}
              </dd>
            </div>
          </dl>

          {lastRun && (
            <p className="text-sm text-muted-foreground">
              {lastRun.summary.created} created, {lastRun.summary.updated} updated,{" "}
              {lastRun.summary.deactivated} deactivated, {lastRun.summary.skipped} skipped,{" "}
              {lastRun.summary.failed} failed
              {lastRun.dry_run ? " (dry run)" : ""}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => callSync("preview")}
              disabled={busyAction !== null}
            >
              {busyAction === "preview" ? "Previewing..." : "Preview sync"}
            </Button>
            <Button onClick={() => callSync("run")} disabled={busyAction !== null}>
              {busyAction === "run" ? "Syncing..." : "Sync now"}
            </Button>
          </div>

          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{result.dryRun ? "Preview result" : "Sync result"}</CardTitle>
            <CardDescription>
              Export generated {formatTimestamp(result.sourceGeneratedAt)}. {result.summary.created}{" "}
              create, {result.summary.updated} update, {result.summary.deactivated} deactivate,{" "}
              {result.summary.unchanged} unchanged, {result.summary.skipped} skipped,{" "}
              {result.summary.failed} failed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.attention.length > 0 && (
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">
                  {result.attention.length} member(s) need attention
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.attention.map((row) => (
                    <li key={`attention-${row.email}-${row.externalId ?? "none"}`}>
                      {row.email}: {row.reason ?? row.errors.join("; ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={`${row.externalId ?? "none"}-${row.email}`}>
                    <TableCell className="whitespace-nowrap">
                      {ACTION_LABELS[row.action] ?? row.action}
                    </TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell className="text-xs">{summarizeChanges(row.changes)}</TableCell>
                    <TableCell className="text-xs">
                      {[row.reason, ...row.warnings, ...row.errors].filter(Boolean).join("; ") ||
                        "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
