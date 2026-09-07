"use client";

import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  statuses: readonly string[];
  selectedStatuses: string[];
  onToggleStatus: (status: string, checked: boolean) => void;
};

export function StatusFilterPanel({ statuses, selectedStatuses, onToggleStatus }: Props) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">Status</div>
      <div className="grid grid-cols-2 gap-2">
        {statuses.map((s) => {
          const checked = selectedStatuses.includes(s);
          return (
            <label key={s} className="flex items-center gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={(v) => onToggleStatus(s, v === true)} />
              <span className="capitalize">{s}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
