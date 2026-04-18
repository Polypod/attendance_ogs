"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { renderAggregatedCell, renderRawCell } from "./cellRenderers";
import type {
  AggregatedAttendanceReportResult,
  ColumnDefinition,
  RawAttendanceReportResult,
  SortDir,
  SortKey,
  ViewMode,
} from "./types";

type CurrentReport = RawAttendanceReportResult | AggregatedAttendanceReportResult;

type Props = {
  error: string | null;
  loading: boolean;

  mode: ViewMode;
  visibleColumns: ColumnDefinition[];

  sortBy: SortKey | null;
  sortDir: SortDir;
  onToggleSort: (key: SortKey) => void;

  rawReport: RawAttendanceReportResult | null;
  aggregatedReport: AggregatedAttendanceReportResult | null;
  currentReport: CurrentReport | null;

  canPrev: boolean;
  canNext: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function ReportResultsPanel({
  error,
  loading,
  mode,
  visibleColumns,
  sortBy,
  sortDir,
  onToggleSort,
  rawReport,
  aggregatedReport,
  currentReport,
  canPrev,
  canNext,
  onPrevPage,
  onNextPage,
}: Props) {
  return (
    <div className="md:col-span-8 space-y-4">
      {error && (
        <Card className="p-4 border border-destructive/30 bg-destructive/10">
          <p className="text-sm">{error}</p>
        </Card>
      )}

      <Card className="p-0 overflow-x-auto min-h-[20rem]">
        {loading ? (
          <div className="p-6 text-muted-foreground">Loading report...</div>
        ) : !currentReport || currentReport.rows.length === 0 ? (
          <div className="p-6 text-muted-foreground">No results.</div>
        ) : (
          <Table className="table-fixed">
            {mode === "raw" && (
              <colgroup>
                {visibleColumns.map((c) => (
                  <col key={c.key} style={{ width: c.width ?? "auto" }} />
                ))}
              </colgroup>
            )}
            <TableHeader>
              <TableRow>
                {visibleColumns.map((c) => {
                  const active = sortBy === c.key;
                  const arrow = active ? (sortDir === "asc" ? " ▲" : " ▼") : "";
                  return (
                    <TableHead key={c.key}>
                      {c.sortable ? (
                        <button
                          type="button"
                          className="w-full text-left select-none"
                          onClick={() => onToggleSort(c.key as SortKey)}
                        >
                          {c.label}
                          {arrow}
                        </button>
                      ) : (
                        c.label
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {mode === "raw"
                ? (rawReport?.rows ?? []).map((r) => (
                    <TableRow key={r.attendance_id}>{visibleColumns.map((c) => renderRawCell(c, r))}</TableRow>
                  ))
                : (aggregatedReport?.rows ?? []).map((r, idx) => (
                    <TableRow
                      key={r.student_id ?? r.class_schedule_id ?? r.class_id ?? r.instructor ?? `row-${idx}`}
                    >
                      {visibleColumns.map((c) => renderAggregatedCell(c, r))}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {currentReport ? (
            <span>
              Total: {currentReport.total} · Page {currentReport.page} / {currentReport.totalPages || 1}
            </span>
          ) : (
            <span />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={!canPrev} onClick={onPrevPage}>
            Previous
          </Button>
          <Button type="button" variant="outline" disabled={!canNext} onClick={onNextPage}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
