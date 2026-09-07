"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type ClassOption = {
  id: string;
  name: string;
  instructor?: string;
};

type Props = {
  classesInRange: ClassOption[];
  selectedClassIds: string[];
  onClearSelected: () => void;
  onToggleClass: (classId: string, checked: boolean) => void;
};

export function ClassesFilterPanel({
  classesInRange,
  selectedClassIds,
  onClearSelected,
  onToggleClass,
}: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium">Classes</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={selectedClassIds.length === 0}
          onClick={onClearSelected}
        >
          Clear
        </Button>
      </div>
      <div className="rounded-md border p-2 min-h-32 max-h-32 overflow-auto space-y-2">
        {classesInRange.length === 0 ? (
          <div className="text-sm text-muted-foreground">No classes in range.</div>
        ) : (
          classesInRange.map((c) => {
            const checked = selectedClassIds.includes(c.id);
            const label = c.instructor ? `${c.name} (${c.instructor})` : c.name;
            return (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={checked} onCheckedChange={(v) => onToggleClass(c.id, v === true)} />
                <span className="truncate" title={label}>
                  {label}
                </span>
              </label>
            );
          })
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {selectedClassIds.length === 0 ? "All classes" : `Selected: ${selectedClassIds.length}`}
      </div>
    </div>
  );
}
