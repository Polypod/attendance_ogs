// frontend/src/lib/api.ts - API wrapper with authentication
import { getSession } from "next-auth/react";

type RequestOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  token?: string; // Optional token for client-side calls
};

/**
 * Fetch wrapper that automatically adds authentication headers
 * For client components, pass the token directly via options
 */
export async function fetchWithAuth(
  endpoint: string,
  options: RequestOptions = {}
): Promise<Response> {
  // If NEXT_PUBLIC_API_URL is not set or empty, use relative URLs (proxy through Next.js)
  // Otherwise use the full URL to connect directly to backend
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const baseUrl = apiUrl && apiUrl.trim() !== '' ? apiUrl : '';

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers
  };

  // Use provided token or get session (for server-side)
  let token = options.token;
  if (!token) {
    const session = await getSession();
    token = (session as any)?.accessToken;
  }

  // Add authorization header if token exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  console.log('[API] Fetching:', `${baseUrl}${endpoint}`);
  console.log('[API] Headers:', headers);

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  console.log('[API] Response status:', response.status);
  console.log('[API] Response ok:', response.ok);

  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[API] Error response:', errorText);
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response;
}

/**
 * Create an API client with a specific token
 * Use this in client components with useSession()
 */
export function createApiClient(token?: string) {
  return {
    get: async (endpoint: string) => {
      console.log('[createApiClient] GET request to:', endpoint);
      const response = await fetchWithAuth(endpoint, { method: "GET", token });
      console.log('[createApiClient] Got response, parsing JSON...');
      const data = await response.json();
      console.log('[createApiClient] Parsed JSON:', data);
      return data;
    },

    post: async (endpoint: string, body: any) => {
      const response = await fetchWithAuth(endpoint, { method: "POST", body, token });
      return response.json();
    },

    put: async (endpoint: string, body: any) => {
      const response = await fetchWithAuth(endpoint, { method: "PUT", body, token });
      return response.json();
    },

    delete: async (endpoint: string) => {
      const response = await fetchWithAuth(endpoint, { method: "DELETE", token });
      return response.json();
    }
  };
}

/**
 * Convenience methods for common HTTP operations
 * Use createApiClient() in client components instead
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
