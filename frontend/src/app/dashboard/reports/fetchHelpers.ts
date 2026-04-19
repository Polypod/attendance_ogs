import { createApiClient } from "@/lib/api";

import { normalizeApiErrorMessage } from "./utils";

type ApiEnvelope<T> = {
  data?: T;
};

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return normalizeApiErrorMessage(error.message);
  return fallback;
}

export async function fetchApiData<T>(accessToken: string, endpoint: string): Promise<T | undefined> {
  const api = createApiClient(accessToken);
  const response = (await api.get(endpoint)) as ApiEnvelope<T> | undefined;
  return response?.data;
}

export async function fetchApiList<T>(accessToken: string, endpoint: string): Promise<T[]> {
  const list = await fetchApiData<T[]>(accessToken, endpoint);
  return list ?? [];
}
