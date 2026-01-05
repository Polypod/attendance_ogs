// frontend/src/lib/api.ts - API wrapper with authentication
import { getSession } from "next-auth/react";

type RequestOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
};

/**
 * Fetch wrapper that automatically adds authentication headers
 */
export async function fetchWithAuth(
  endpoint: string,
  options: RequestOptions = {}
): Promise<Response> {
  const session = await getSession();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers
  };

  // Add authorization header if session exists
  if (session?.accessToken) {
    headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  return response;
}

/**
 * Convenience methods for common HTTP operations
 */
export const api = {
  get: async (endpoint: string) => {
    const response = await fetchWithAuth(endpoint, { method: "GET" });
    return response.json();
  },

  post: async (endpoint: string, body: any) => {
    const response = await fetchWithAuth(endpoint, { method: "POST", body });
    return response.json();
  },

  put: async (endpoint: string, body: any) => {
    const response = await fetchWithAuth(endpoint, { method: "PUT", body });
    return response.json();
  },

  delete: async (endpoint: string) => {
    const response = await fetchWithAuth(endpoint, { method: "DELETE" });
    return response.json();
  }
};
