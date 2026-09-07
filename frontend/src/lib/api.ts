// frontend/src/lib/api.ts - API wrapper with authentication
import { getSession } from "next-auth/react";
import { logger } from "@/lib/logger";

type RequestOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  token?: string; // Optional token for client-side calls
};

function generateRequestId(): string {
  try {
    const cryptoObj = (globalThis as any)?.crypto;
    if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  } catch {
    // ignore
  }

  return `rid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

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

  const existingRequestId = headers["X-Request-Id"] ?? headers["x-request-id"];
  const requestId = (existingRequestId && existingRequestId.trim().length > 0)
    ? existingRequestId
    : generateRequestId();
  if (!existingRequestId) {
    headers["X-Request-Id"] = requestId;
  }

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

  const debug = logger.isDebugEnabled();

  // Only log in development mode to avoid exposing sensitive data in production
  if (debug && process.env.NODE_ENV === 'development') {
    const safeHeaders = { ...headers };
    delete safeHeaders['Authorization'];
    logger.debug('api_request', { endpoint, method: options.method ?? 'GET', requestId, headers: safeHeaders });
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const responseRequestId = response.headers.get('x-request-id') ?? requestId;

  if (debug && process.env.NODE_ENV === 'development') {
    logger.debug('api_response', { endpoint, status: response.status, ok: response.ok, requestId: responseRequestId });
  }

  // Handle 401 Unauthorized - redirect to login
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const errorText = await response.text();
    if (process.env.NODE_ENV === 'development') {
      logger.error('api_error_response', { endpoint, status: response.status, requestId: responseRequestId, body: errorText });
    } else {
      logger.error('api_error_response', { endpoint, status: response.status, requestId: responseRequestId });
    }
    throw new Error(`HTTP ${response.status} [requestId=${responseRequestId}]: ${errorText}`);
  }

  return response;
}

/**
 * Create an API client with a specific token
 * Use this in client components with useSession()
 */
export function createApiClient(token?: string) {
  const debug = logger.isDebugEnabled();

  return {
    get: async (endpoint: string) => {
      if (debug && process.env.NODE_ENV === 'development') {
        logger.debug('api_client_get', { endpoint });
      }
      const response = await fetchWithAuth(endpoint, { method: "GET", token });
      if (debug && process.env.NODE_ENV === 'development') {
        logger.debug('api_client_parse_json', { endpoint });
      }
      const data = await response.json();
      if (debug && process.env.NODE_ENV === 'development') {
        logger.debug('api_client_parsed', { endpoint });
      }
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
