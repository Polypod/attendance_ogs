"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ImportRow = {
  rowNumber: number;
  valid: boolean;
  action: "create" | "update" | "skip";
  errors: string[];
  displayStudent: {
    name?: string;
    email?: string;
    categories?: string[];
    belt_level?: string;
    active?: boolean | null;
    status?: string;
  };
  normalizedStudent?: {
    name: string;
    email: string;
    categories: string[];
    belt_level: string;
    active: boolean;
    status: string;
  };
};

type ImportAction = "create" | "update" | "skip";

// Excel on Windows often exports CSV as Windows-1252 instead of UTF-8, which
// mangles Swedish letters (å/ä/ö) when decoded as UTF-8. Detect and fall back.
const readFileAsText = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
};

type ImportResult = {
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    created?: number;
    updated?: number;
    skipped?: number;
  };
  rows: ImportRow[];
};

type ApiPayload<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
};

type ImportHistoryEntry = {
  id: string;
  filename: string;
  importedAt: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  invalidRows: number;
};

const IMPORT_HISTORY_STORAGE_KEY = "settings.studentImportHistory";

const TEMPLATE_HEADERS = [
  "name",
  "email",
  "categories",
  "belt_level",
  "phone",
  "emergency_contact_name",
  "emergency_contact_phone",
  "active",
  "status",
];

const TEMPLATE_EXAMPLE_ROW = [
  "Example Student",
  "example.student@example.com",
  "kids|adult",
  "10kyu",
  "070-123456",
  "Guardian Name",
  "070-654321",
  "true",
  "active",
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}

function extractFilename(disposition: string | null): string {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? "students-export.csv";
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

function formatImportTimestamp(value: string): string {
  return new Date(value).toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StudentDataSettings() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [applyResult, setApplyResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"export" | "preview" | "apply" | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([]);
  const [actionOverrides, setActionOverrides] = useState<Record<number, ImportAction>>({});

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(IMPORT_HISTORY_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as ImportHistoryEntry[];
      if (Array.isArray(parsed)) {
        setImportHistory(parsed);
      }
    } catch {
      window.localStorage.removeItem(IMPORT_HISTORY_STORAGE_KEY);
    }
  }, []);

  const hasValidPreview = Boolean(previewResult && previewResult.rows.some((row) => row.valid && (actionOverrides[row.rowNumber] ?? row.action) !== "skip"));
  const validPreviewRows = previewResult?.rows.filter((row) => row.valid) ?? [];
  const allValidRowsSkipped = validPreviewRows.length > 0 && validPreviewRows.every(
    (row) => (actionOverrides[row.rowNumber] ?? row.action) === "skip"
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setPreviewResult(null);
    setApplyResult(null);
    setError(null);
    setCsvContent("");
    setActionOverrides({});
  };

  const resetImportState = () => {
    setSelectedFile(null);
    setCsvContent("");
    setPreviewResult(null);
    setApplyResult(null);
    setError(null);
    setFileInputKey((current) => current + 1);
    setActionOverrides({});
  };

  const handleTemplateDownload = () => {
    setError(null);
    const template = [TEMPLATE_HEADERS.join(","), TEMPLATE_EXAMPLE_ROW.join(",")].join("\n");
    downloadTextFile(template, "students-import-template.csv", "text/csv;charset=utf-8");
  };

  const handleExport = async () => {
    setBusyAction("export");
    setError(null);

    try {
      const response = await fetch("/frontend-api/students/export/csv", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const blob = await response.blob();
      const filename = extractFilename(response.headers.get("content-disposition"));
      downloadTextFile(await blob.text(), filename, blob.type || "text/csv;charset=utf-8");
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setError("Choose a CSV file first.");
      return;
    }

    setBusyAction("preview");
    setError(null);
    setApplyResult(null);

    try {
      const nextCsvContent = await readFileAsText(selectedFile);
      const response = await fetch("/frontend-api/students/import/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csvContent: nextCsvContent }),
      });

      const payload = (await response.json()) as ApiPayload<ImportResult>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || payload.message || "Preview failed");
      }

      setCsvContent(nextCsvContent);
      setPreviewResult(payload.data);
      setActionOverrides({});
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      setPreviewResult(null);
      setCsvContent("");
      setActionOverrides({});
    } finally {
      setBusyAction(null);
    }
  };

  const handleSkipChange = (rowNumber: number, checked: boolean) => {
    setActionOverrides((current) => {
      if (!checked) {
        const nextOverrides = { ...current };
        delete nextOverrides[rowNumber];
        return nextOverrides;
      }

      return {
        ...current,
        [rowNumber]: "skip",
      };
    });
  };

  const handleSkipAllChange = (checked: boolean) => {
    if (!previewResult) {
      return;
    }

    setActionOverrides((current) => {
      if (!checked) {
        const nextOverrides = { ...current };
        for (const row of previewResult.rows) {
          if (row.valid) {
            delete nextOverrides[row.rowNumber];
          }
        }
        return nextOverrides;
      }

      const nextOverrides = { ...current };
      for (const row of previewResult.rows) {
        if (row.valid) {
          nextOverrides[row.rowNumber] = "skip";
        }
      }
      return nextOverrides;
    });
  };

  const handleApply = async () => {
    if (!csvContent) {
      setError("Generate a valid preview before applying the import.");
      return;
    }

    setBusyAction("apply");
    setError(null);

    try {
      const response = await fetch("/frontend-api/students/import/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csvContent, actionOverrides }),
      });

      const payload = (await response.json()) as ApiPayload<ImportResult>;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || payload.message || "Import failed");
      }

      setApplyResult(payload.data);
      const nextHistoryEntry: ImportHistoryEntry = {
        id: `${Date.now()}`,
        filename: selectedFile?.name ?? "manual-upload.csv",
        importedAt: new Date().toISOString(),
        totalRows: payload.data.summary.totalRows,
        created: payload.data.summary.created ?? 0,
        updated: payload.data.summary.updated ?? 0,
        skipped: payload.data.summary.skipped ?? 0,
        invalidRows: payload.data.summary.invalidRows,
      };

      setImportHistory((current) => {
        const nextHistory = [nextHistoryEntry, ...current].slice(0, 10);
        window.localStorage.setItem(IMPORT_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
        return nextHistory;
      });

      setSelectedFile(null);
      setCsvContent("");
      setPreviewResult(null);
      setFileInputKey((current) => current + 1);
      setActionOverrides({});
    } catch (nextError) {
      setError(getErrorMessage(nextError));
      setApplyResult(null);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export students</CardTitle>
          <CardDescription>
            Download the current student register as a CSV file that can be reviewed or edited offline.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            The export includes name, email, categories, belt level, phone, emergency contact, active flag, and status.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" onClick={handleTemplateDownload} disabled={busyAction !== null}>
              Download template
            </Button>
            <Button onClick={handleExport} disabled={busyAction !== null}>
              {busyAction === "export" ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import students</CardTitle>
          <CardDescription>
            Upload a CSV export, inspect the preview result, and apply it only after the rows validate cleanly. Both comma and semicolon separators are accepted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div className="space-y-2">
              <label htmlFor="student-import-file" className="text-sm font-medium">
                CSV file
              </label>
              <Input key={fileInputKey} id="student-import-file" type="file" accept=".csv,text/csv" onChange={handleFileChange} />
            </div>
            <Button onClick={handlePreview} disabled={!selectedFile || busyAction !== null}>
              {busyAction === "preview" ? "Previewing..." : "Preview import"}
            </Button>
            <Button onClick={handleApply} disabled={!hasValidPreview || busyAction !== null}>
              {busyAction === "apply" ? "Applying..." : "Apply import"}
            </Button>
          </div>

          {previewResult && previewResult.summary.invalidRows > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Invalid rows will be skipped automatically. You can also change valid rows to skip before applying the import.
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {previewResult ? (
            <div className="space-y-4 rounded-xl border p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <div className="font-medium">Rows in file</div>
                  <div className="text-2xl font-semibold">{previewResult.summary.totalRows}</div>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                  <div className="font-medium">Valid rows</div>
                  <div className="text-2xl font-semibold">{previewResult.summary.validRows}</div>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  <div className="font-medium">Invalid rows</div>
                  <div className="text-2xl font-semibold">{previewResult.summary.invalidRows}</div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Checkbox
                          checked={allValidRowsSkipped}
                          disabled={validPreviewRows.length === 0}
                          onCheckedChange={(checked) => handleSkipAllChange(checked === true)}
                        />
                        <span>Skip</span>
                      </label>
                    </TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewResult.rows.map((row) => (
                    <TableRow key={row.rowNumber}>
                      <TableCell>{row.rowNumber}</TableCell>
                      <TableCell>{row.valid ? "Valid" : "Invalid"}</TableCell>
                      <TableCell>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={!row.valid || (actionOverrides[row.rowNumber] ?? row.action) === "skip"}
                            disabled={!row.valid}
                            onCheckedChange={(checked) => handleSkipChange(row.rowNumber, checked === true)}
                          />
                          <span>{!row.valid ? "Skipped" : "Skip"}</span>
                        </label>
                      </TableCell>
                      <TableCell>
                        {row.normalizedStudent || row.displayStudent ? (
                          <div className="min-w-[220px] whitespace-normal">
                            <div className="font-medium">{row.normalizedStudent?.name || row.displayStudent.name || "Unnamed row"}</div>
                            {row.normalizedStudent?.email || row.displayStudent.email ? (
                              <div className="text-xs text-muted-foreground">{row.normalizedStudent?.email || row.displayStudent.email}</div>
                            ) : null}
                            {row.normalizedStudent?.categories?.length || row.displayStudent.categories?.length || row.normalizedStudent?.belt_level || row.displayStudent.belt_level ? (
                              <div className="text-xs text-muted-foreground">
                                {((row.normalizedStudent?.categories || row.displayStudent.categories || []).join(", ")) || "No categories"}
                                {(row.normalizedStudent?.belt_level || row.displayStudent.belt_level)
                                  ? ` · ${row.normalizedStudent?.belt_level || row.displayStudent.belt_level}`
                                  : ""}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No normalized data</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[280px] whitespace-normal">
                        {row.errors.length > 0 ? row.errors.join(", ") : "None"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {applyResult ? (
            <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <div>
                Import complete. Created {applyResult.summary.created ?? 0}, updated {applyResult.summary.updated ?? 0}, skipped {applyResult.summary.skipped ?? 0}, invalid {applyResult.summary.invalidRows}.
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="sm">
                  <Link href="/dashboard/students">Review students</Link>
                </Button>
                <Button variant="outline" size="sm" onClick={resetImportState}>
                  Import another file
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent imports</CardTitle>
          <CardDescription>
            Review the latest student imports completed from this browser session history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {importHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
              No imports have been applied from this browser yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imported</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Total rows</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Skipped</TableHead>
                  <TableHead>Invalid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatImportTimestamp(entry.importedAt)}</TableCell>
                    <TableCell className="max-w-[220px] whitespace-normal">{entry.filename}</TableCell>
                    <TableCell>{entry.totalRows}</TableCell>
                    <TableCell>{entry.created}</TableCell>
                    <TableCell>{entry.updated}</TableCell>
                    <TableCell>{entry.skipped}</TableCell>
                    <TableCell>{entry.invalidRows}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}