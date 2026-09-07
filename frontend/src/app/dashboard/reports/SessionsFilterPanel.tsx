"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type SessionOption = {
  key: string;
  label: string;
};

type Props = {
  sessionOptions: SessionOption[];
  selectedSessionKeys: string[];
  onClearSelected: () => void;
  onToggleSession: (key: string, checked: boolean) => void;
};

export function SessionsFilterPanel({
  sessionOptions,
  selectedSessionKeys,
  onClearSelected,
  onToggleSession,
}: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium">Sessions</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={selectedSessionKeys.length === 0}
          onClick={onClearSelected}
        >
          Clear
        </Button>
      </div>
      <div className="rounded-md border p-2 min-h-48 max-h-48 overflow-auto space-y-2">
        {sessionOptions.length === 0 ? (
          <div className="text-sm text-muted-foreground">No sessions in range.</div>
        ) : (
          sessionOptions.map((s) => {
            const checked = selectedSessionKeys.includes(s.key);
            return (
              <label key={s.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={checked} onCheckedChange={(v) => onToggleSession(s.key, v === true)} />
                <span className="truncate" title={s.label}>
                  {s.label}
                </span>
              </label>
            );
          })
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {selectedSessionKeys.length === 0 ? "All sessions" : `Selected: ${selectedSessionKeys.length}`}
      </div>
    </div>
  );
}
