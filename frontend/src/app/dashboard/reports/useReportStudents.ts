"use client";

import { useEffect, useState } from "react";

import type { Student } from "./types";
import { fetchApiList, getApiErrorMessage } from "./fetchHelpers";

export function useReportStudents(args: {
  enabled: boolean;
  accessToken?: string;
  onError: (msg: string | null) => void;
}): { students: Student[] } {
  const { enabled, accessToken, onError } = args;
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function loadStudents() {
      if (!enabled || !accessToken) return;

      try {
        onError(null);
        const list = await fetchApiList<Student>(accessToken, "/api/students");
        if (!isCancelled) setStudents(list);
      } catch (e: unknown) {
        if (!isCancelled) onError(getApiErrorMessage(e, "Failed to fetch students"));
      }
    }

    loadStudents();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, enabled, onError]);

  return { students };
}
