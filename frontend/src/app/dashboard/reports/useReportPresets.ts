"use client";

import { useEffect, useState } from "react";
import { createApiClient } from "@/lib/api";

import type { ReportPreset } from "./types";
import { normalizeApiErrorMessage } from "./utils";

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
        const api = createApiClient(accessToken);
        const data = await api.get("/api/report-presets");
        const list: ReportPreset[] = data?.data ?? [];
        if (!isCancelled) setPresets(list);
      } catch (e: unknown) {
        if (!isCancelled) {
          if (e instanceof Error) onPresetError(normalizeApiErrorMessage(e.message));
          else onPresetError("Failed to fetch presets");
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

    const api = createApiClient(accessToken);
    const data = await api.get("/api/report-presets");
    const list: ReportPreset[] = data?.data ?? [];
    setPresets(list);

    if (nextSelectedId !== undefined) {
      onSetSelectedPresetId(nextSelectedId);
    }
  };

  return { presets, reloadPresets };
}
