import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { ApiError, getAuthHeaders } from "./api";

const isDev = typeof window !== 'undefined' && import.meta.env?.DEV;

async function parseErrorResponse(res: Response, endpoint: string): Promise<ApiError> {
  let errorData: any = {
    error: res.statusText,
    code: res.status === 401 ? 'AUTH_REQUIRED' : 'UNKNOWN',
    traceId: 'unknown',
  };

  try {
    const json = await res.json();
    errorData = { ...errorData, ...json };
  } catch {
    try {
      const text = await res.text();
      errorData.detail = text;
    } catch {
    }
  }

  return new ApiError({
    success: false,
    error: errorData.error || res.statusText,
    code: errorData.code || 'UNKNOWN',
    traceId: errorData.traceId || 'unknown',
    detail: errorData.detail,
    stack: errorData.stack,
    status: res.status,
    endpoint,
  });
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...getAuthHeaders(),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    throw await parseErrorResponse(res, url);
  }
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const endpoint = queryKey[0] as string;
    const res = await fetch(endpoint, {
      credentials: "include",
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) {
      const apiError = await parseErrorResponse(res, endpoint);
      
      if (isDev) {
        console.error(`[QUERY ERROR] ${queryKey.join('/')}`, {
          status: res.status,
          code: apiError.code,
          traceId: apiError.traceId,
        });
      }
      
      throw apiError;
    }
    
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});
