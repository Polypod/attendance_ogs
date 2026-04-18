"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import type { ColumnDefinition, ColumnKey } from "./types";

type Props = {
  orderedColumns: ColumnDefinition[];
  activeColumnVisibility: Record<string, boolean>;
  onSetColumnVisible: (key: ColumnKey, visible: boolean) => void;
  onMoveColumn: (key: ColumnKey, direction: -1 | 1) => void;
};

export function ColumnsPanel({
  orderedColumns,
  activeColumnVisibility,
  onSetColumnVisible,
  onMoveColumn,
}: Props) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">Columns</div>
      <div className="space-y-2">
        {orderedColumns.map((c, idx) => {
          const checked = activeColumnVisibility[c.key] !== false;
          return (
            <div key={c.key} className="flex items-center gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={(v) => onSetColumnVisible(c.key, v === true)} />
              <span className="flex-1">{c.label}</span>
              <Button
                type="button"
                variant="outline"
                className="h-7 w-7 p-0"
                disabled={idx === 0}
                onClick={() => onMoveColumn(c.key, -1)}
                aria-label={`Move ${c.label} up`}
                title="Move up"
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-7 w-7 p-0"
                disabled={idx === orderedColumns.length - 1}
                onClick={() => onMoveColumn(c.key, 1)}
                aria-label={`Move ${c.label} down`}
                title="Move down"
              >
                ↓
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
