"use client";

import { useEffect, useState } from "react";
import { createApiClient } from "@/lib/api";

import type { Schedule } from "./types";
import { normalizeApiErrorMessage } from "./utils";

export function useReportSchedules(args: {
  enabled: boolean;
  accessToken?: string;
  from: string;
  to: string;
  onError: (msg: string) => void;
}): { schedules: Schedule[] } {
  const { enabled, accessToken, from, to, onError } = args;
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function loadSchedules() {
      if (!enabled || !accessToken) return;

      try {
        const qs = new URLSearchParams({
          startDate: from,
          endDate: to,
          expandRecurring: "true",
        });
        const api = createApiClient(accessToken);
        const data = await api.get(`/api/schedules?${qs.toString()}`);
        const list: Schedule[] = data?.data ?? [];
        if (!isCancelled) setSchedules(list);
      } catch (e: unknown) {
        if (e instanceof Error) onError(normalizeApiErrorMessage(e.message));
        else onError("Failed to fetch schedules");
      }
    }

    loadSchedules();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, enabled, from, onError, to]);

  return { schedules };
}
