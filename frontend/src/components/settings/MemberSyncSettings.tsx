"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type DisplayRow = {
  key: string;
  action: string;
  name: string;
  email: string;
  changes: string;
  notes: string;
};

type SortColumn = keyof Omit<DisplayRow, "key">;
type SortState = { column: SortColumn; direction: "asc" | "desc" } | null;

const displayRow = (row: SyncRow): DisplayRow => ({
  key: `${row.externalId ?? "none"}-${row.email}`,
  action: ACTION_LABELS[row.action] ?? row.action,
  name: row.name,
  email: row.email,
  changes: summarizeChanges(row.changes),
  notes: [row.reason, ...row.warnings, ...row.errors].filter(Boolean).join("; ") || "-",
});

const filterAndSortRows = (
  rows: DisplayRow[],
  query: string,
  sort: SortState,
  columns: SortColumn[],
): DisplayRow[] => {
  const search = query.trim().toLocaleLowerCase();
  const filtered = search
    ? rows.filter((row) =>
        columns.some((column) => row[column].toLocaleLowerCase().includes(search)),
      )
    : rows;

  if (!sort) return filtered;

  return [...filtered].sort((a, b) => {
    const comparison = a[sort.column].localeCompare(b[sort.column], undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return sort.direction === "asc" ? comparison : -comparison;
  });
};

const RESULT_COLUMNS: SortColumn[] = ["action", "name", "email", "changes", "notes"];
const ATTENTION_COLUMNS: SortColumn[] = ["name", "email", "notes"];

function SortableHead({
  column,
  label,
  sort,
  onSort,
}: {
  column: SortColumn;
  label: string;
  sort: SortState;
  onSort: (column: SortColumn) => void;
}) {
  const direction = sort?.column === column ? sort.direction : null;

  return (
    <TableHead
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {label}
        <span aria-hidden="true" className="text-muted-foreground">
          {direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}
        </span>
      </button>
    </TableHead>
  );
}

export default function MemberSyncSettings() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [busyAction, setBusyAction] = useState<"preview" | "run" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowSearch, setRowSearch] = useState("");
  const [attentionSearch, setAttentionSearch] = useState("");
  const [rowSort, setRowSort] = useState<SortState>(null);
  const [attentionSort, setAttentionSort] = useState<SortState>(null);

  const rows = useMemo(() => result?.rows.map(displayRow) ?? [], [result]);
  const attentionRows = useMemo(() => result?.attention.map(displayRow) ?? [], [result]);
  const visibleRows = useMemo(
    () => filterAndSortRows(rows, rowSearch, rowSort, RESULT_COLUMNS),
    [rows, rowSearch, rowSort],
  );
  const visibleAttentionRows = useMemo(
    () => filterAndSortRows(attentionRows, attentionSearch, attentionSort, ATTENTION_COLUMNS),
    [attentionRows, attentionSearch, attentionSort],
  );

  const toggleRowSort = (column: SortColumn) => {
    setRowSort((current) => ({
      column,
      direction: current?.column === column && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const toggleAttentionSort = (column: SortColumn) => {
    setAttentionSort((current) => ({
      column,
      direction: current?.column === column && current.direction === "asc" ? "desc" : "asc",
    }));
  };

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
      setRowSearch("");
      setAttentionSearch("");
      setRowSort(null);
      setAttentionSort(null);
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
              <div className="space-y-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">
                  {result.attention.length} member(s) need attention
                </p>
                <label htmlFor="sync-attention-search" className="sr-only">
                  Search members needing attention
                </label>
                <Input
                  id="sync-attention-search"
                  type="search"
                  value={attentionSearch}
                  onChange={(event) => setAttentionSearch(event.target.value)}
                  placeholder="Search members needing attention..."
                  className="max-w-sm bg-white"
                />
                <p aria-live="polite">
                  Showing {visibleAttentionRows.length} of {attentionRows.length}
                </p>
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <SortableHead
                        column="name"
                        label="Name"
                        sort={attentionSort}
                        onSort={toggleAttentionSort}
                      />
                      <SortableHead
                        column="email"
                        label="Email"
                        sort={attentionSort}
                        onSort={toggleAttentionSort}
                      />
                      <SortableHead
                        column="notes"
                        label="Notes"
                        sort={attentionSort}
                        onSort={toggleAttentionSort}
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleAttentionRows.map((row) => (
                      <TableRow key={`attention-${row.key}`}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.email}</TableCell>
                        <TableCell className="max-w-[28rem] whitespace-normal">{row.notes}</TableCell>
                      </TableRow>
                    ))}
                    {visibleAttentionRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3}>No matching members.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            <label htmlFor="sync-member-search" className="sr-only">
              Search sync members
            </label>
            <Input
              id="sync-member-search"
              type="search"
              value={rowSearch}
              onChange={(event) => setRowSearch(event.target.value)}
              placeholder="Search sync members..."
              className="max-w-sm"
            />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing {visibleRows.length} of {rows.length}
            </p>
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <SortableHead
                    column="action"
                    label="Action"
                    sort={rowSort}
                    onSort={toggleRowSort}
                  />
                  <SortableHead column="name" label="Name" sort={rowSort} onSort={toggleRowSort} />
                  <SortableHead
                    column="email"
                    label="Email"
                    sort={rowSort}
                    onSort={toggleRowSort}
                  />
                  <SortableHead
                    column="changes"
                    label="Changes"
                    sort={rowSort}
                    onSort={toggleRowSort}
                  />
                  <SortableHead
                    column="notes"
                    label="Notes"
                    sort={rowSort}
                    onSort={toggleRowSort}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="whitespace-nowrap">{row.action}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell className="max-w-[28rem] whitespace-normal text-xs">{row.changes}</TableCell>
                    <TableCell className="max-w-[28rem] whitespace-normal text-xs">{row.notes}</TableCell>
                  </TableRow>
                ))}
                {visibleRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>No matching members.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
