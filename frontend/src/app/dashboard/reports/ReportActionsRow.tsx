"use client";

import { Button } from "@/components/ui/button";

type Props = {
  onReset: () => void;
  onExportCsv: () => void;
  exportDisabled: boolean;
};

export function ReportActionsRow({ onReset, onExportCsv, exportDisabled }: Props) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Button type="button" variant="outline" onClick={onReset}>
        Reset
      </Button>

      <Button type="button" onClick={onExportCsv} disabled={exportDisabled}>
        Export CSV
      </Button>
    </div>
  );
}
