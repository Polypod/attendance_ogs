"use client";

import { useEffect, useState } from "react";

import type { Schedule } from "./types";
import { fetchApiList, getApiErrorMessage } from "./fetchHelpers";

export function useReportSchedules(args: {
  enabled: boolean;
  accessToken?: string;
  from: string;
  to: string;
  onError: (msg: string | null) => void;
}): { schedules: Schedule[] } {
  const { enabled, accessToken, from, to, onError } = args;
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function loadSchedules() {
      if (!enabled || !accessToken) return;

      try {
        onError(null);
        const qs = new URLSearchParams({
          startDate: from,
          endDate: to,
          expandRecurring: "true",
        });
        const list = await fetchApiList<Schedule>(accessToken, `/api/schedules?${qs.toString()}`);
        if (!isCancelled) setSchedules(list);
      } catch (e: unknown) {
        if (!isCancelled) onError(getApiErrorMessage(e, "Failed to fetch schedules"));
      }
    }

    loadSchedules();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, enabled, from, onError, to]);

  return { schedules };
}
