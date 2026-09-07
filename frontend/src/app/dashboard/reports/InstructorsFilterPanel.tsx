"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type Props = {
  instructors: string[];
  selectedInstructors: string[];
  onClearSelected: () => void;
  onToggleInstructor: (name: string, checked: boolean) => void;
};

export function InstructorsFilterPanel({
  instructors,
  selectedInstructors,
  onClearSelected,
  onToggleInstructor,
}: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium">Instructors</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={selectedInstructors.length === 0}
          onClick={onClearSelected}
        >
          Clear
        </Button>
      </div>
      <div className="rounded-md border p-2 min-h-32 max-h-32 overflow-auto space-y-2">
        {instructors.length === 0 ? (
          <div className="text-sm text-muted-foreground">No instructors in range.</div>
        ) : (
          instructors.map((name) => {
            const checked = selectedInstructors.includes(name);
            return (
              <label key={name} className="flex items-center gap-2 text-sm">
                <Checkbox checked={checked} onCheckedChange={(v) => onToggleInstructor(name, v === true)} />
                <span className="truncate" title={name}>
                  {name}
                </span>
              </label>
            );
          })
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {selectedInstructors.length === 0 ? "All instructors" : `Selected: ${selectedInstructors.length}`}
      </div>
    </div>
  );
}
