"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { ReportPreset, ReportPresetState } from "./types";

type Props = {
  presets: ReportPreset[];
  selectedPresetId: string;
  presetNameDraft: string;
  presetSharedDraft: boolean;
  presetBusy: boolean;
  presetError: string | null;
  isAdmin: boolean;
  instructorEditingShared: boolean;

  onSelectedPresetIdChange: (id: string) => void;
  onPresetNameDraftChange: (name: string) => void;
  onPresetSharedDraftChange: (shared: boolean) => void;
  onPresetErrorChange: (error: string | null) => void;
  onApplyPresetState: (state: ReportPresetState) => void;

  onSave: () => void;
  onUpdate: () => void;
  onDelete: () => void;
};

export function PresetsPanel({
  presets,
  selectedPresetId,
  presetNameDraft,
  presetSharedDraft,
  presetBusy,
  presetError,
  isAdmin,
  instructorEditingShared,
  onSelectedPresetIdChange,
  onPresetNameDraftChange,
  onPresetSharedDraftChange,
  onPresetErrorChange,
  onApplyPresetState,
  onSave,
  onUpdate,
  onDelete,
}: Props) {
  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="text-sm font-medium">Presets</div>

      <div>
        <label htmlFor="preset" className="block text-sm font-medium mb-1">
          Select preset
        </label>
        <Select
          value={selectedPresetId ? selectedPresetId : "__none"}
          onValueChange={(v) => {
            if (v === "__none") {
              onSelectedPresetIdChange("");
              return;
            }

            const preset = presets.find((p) => p._id === v);
            onSelectedPresetIdChange(v);

            if (preset) {
              onPresetErrorChange(null);
              onPresetNameDraftChange(preset.name);
              onPresetSharedDraftChange(preset.shared);
              onApplyPresetState(preset.state);
            }
          }}
        >
          <SelectTrigger id="preset" className="w-full">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">None</SelectItem>
            {presets.map((p) => (
              <SelectItem key={p._id} value={p._id}>
                {p.shared ? `Shared: ${p.name}` : `My: ${p.name}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label htmlFor="presetName" className="block text-sm font-medium mb-1">
          Preset name
        </label>
        <Input
          id="presetName"
          value={presetNameDraft}
          onChange={(e) => onPresetNameDraftChange(e.target.value)}
          placeholder="e.g. My weekly view"
        />
      </div>

      {isAdmin && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={presetSharedDraft} onCheckedChange={(v) => onPresetSharedDraftChange(v === true)} />
          <span>Shared</span>
        </label>
      )}

      {instructorEditingShared && (
        <p className="text-xs text-muted-foreground">Shared presets are read-only for instructors.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onSave} disabled={presetBusy || presetNameDraft.trim().length < 1}>
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onUpdate}
          disabled={presetBusy || !selectedPresetId || instructorEditingShared}
        >
          Update
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onDelete}
          disabled={presetBusy || !selectedPresetId || instructorEditingShared}
        >
          Delete
        </Button>
      </div>

      {presetError && <p className="text-xs text-destructive">{presetError}</p>}
    </div>
  );
}
