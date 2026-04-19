"use client";

import { useEffect, useState } from "react";
import { createApiClient } from "@/lib/api";

import type { Student } from "./types";
import { normalizeApiErrorMessage } from "./utils";

export function useReportStudents(args: {
  enabled: boolean;
  accessToken?: string;
  onError: (msg: string) => void;
}): { students: Student[] } {
  const { enabled, accessToken, onError } = args;
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function loadStudents() {
      if (!enabled || !accessToken) return;

      try {
        const api = createApiClient(accessToken);
        const data = await api.get("/api/students");
        const list: Student[] = data?.data ?? [];
        if (!isCancelled) setStudents(list);
      } catch (e: unknown) {
        if (e instanceof Error) onError(normalizeApiErrorMessage(e.message));
        else onError("Failed to fetch students");
      }
    }

    loadStudents();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, enabled, onError]);

  return { students };
}
