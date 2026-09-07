"use client";

import { useEffect, useState } from "react";

import type { ReportPreset } from "./types";
import { fetchApiList, getApiErrorMessage } from "./fetchHelpers";

export function useReportPresets(args: {
  enabled: boolean;
  accessToken?: string;
  onPresetError: (msg: string | null) => void;
  onSetSelectedPresetId: (id: string) => void;
}): { presets: ReportPreset[]; reloadPresets: (nextSelectedId?: string) => Promise<void> } {
  const { enabled, accessToken, onPresetError, onSetSelectedPresetId } = args;
  const [presets, setPresets] = useState<ReportPreset[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function loadPresets() {
      if (!enabled || !accessToken) return;

      try {
        onPresetError(null);
        const list = await fetchApiList<ReportPreset>(accessToken, "/api/report-presets");
        if (!isCancelled) setPresets(list);
      } catch (e: unknown) {
        if (!isCancelled) {
          onPresetError(getApiErrorMessage(e, "Failed to fetch presets"));
        }
      }
    }

    loadPresets();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, enabled, onPresetError]);

  const reloadPresets = async (nextSelectedId?: string) => {
    if (!enabled || !accessToken) return;

    try {
      onPresetError(null);
      const list = await fetchApiList<ReportPreset>(accessToken, "/api/report-presets");
      setPresets(list);
      if (nextSelectedId !== undefined) {
        onSetSelectedPresetId(nextSelectedId);
      }
    } catch (e: unknown) {
      onPresetError(getApiErrorMessage(e, "Failed to fetch presets"));
    }
  };

  return { presets, reloadPresets };
}
