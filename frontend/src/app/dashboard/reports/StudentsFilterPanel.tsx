"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import type { Student } from "./types";

type Props = {
  students: Student[];
  selectedStudentIds: string[];
  onlyActiveStudents: boolean;
  onOnlyActiveStudentsChange: (value: boolean) => void;
  onClearSelected: () => void;
  onToggleStudent: (studentId: string, checked: boolean) => void;
};

export function StudentsFilterPanel({
  students,
  selectedStudentIds,
  onlyActiveStudents,
  onOnlyActiveStudentsChange,
  onClearSelected,
  onToggleStudent,
}: Props) {
  const visibleStudents = students
    .filter((s) => {
      if (!onlyActiveStudents) return true;
      const isActive = (s.active ?? true) !== false && (s.status ?? "active") !== "inactive";
      return isActive;
    })
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium">Students</label>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
            <Checkbox checked={onlyActiveStudents} onCheckedChange={(v) => onOnlyActiveStudentsChange(v === true)} />
            <span>Only active</span>
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={selectedStudentIds.length === 0}
            onClick={onClearSelected}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="rounded-md border p-2 min-h-40 max-h-40 overflow-auto space-y-2">
        {visibleStudents.map((s) => {
          const checked = selectedStudentIds.includes(s._id);
          return (
            <label key={s._id} className="flex items-center gap-2 text-sm">
              <Checkbox checked={checked} onCheckedChange={(v) => onToggleStudent(s._id, v === true)} />
              <span className="truncate" title={s.name}>
                {s.name}
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-1 text-xs text-muted-foreground">
        {selectedStudentIds.length === 0 ? "All students" : `Selected: ${selectedStudentIds.length}`}
      </div>
    </div>
  );
}
