/**
 * API UTILITIES
 * 
 * Centralized API calls with error handling and traceId support.
 */

const API_BASE = '';

export interface ApiErrorDetails {
  success: false;
  error: string;
  code: string;
  traceId: string;
  detail?: string;
  stack?: string;
  status: number;
  endpoint: string;
}

export class ApiError extends Error {
  public readonly success = false;
  public readonly code: string;
  public readonly traceId: string;
  public readonly detail?: string;
  public readonly devStack?: string;
  public readonly status: number;
  public readonly endpoint: string;

  constructor(details: ApiErrorDetails) {
    super(details.error);
    this.code = details.code;
    this.traceId = details.traceId;
    this.detail = details.detail;
    this.devStack = details.stack;
    this.status = details.status;
    this.endpoint = details.endpoint;
    this.name = 'ApiError';
  }

  toJSON(): ApiErrorDetails {
    return {
      success: false,
      error: this.message,
      code: this.code,
      traceId: this.traceId,
      detail: this.detail,
      stack: this.devStack,
      status: this.status,
      endpoint: this.endpoint,
    };
  }
}

export function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem('cc_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  const isDev = import.meta.env.DEV;
  
  if (isDev && (endpoint.includes('/api/schedule') || endpoint.includes('/api/admin'))) {
    const authHeaders = getAuthHeaders();
    if (!headers['Authorization'] && !authHeaders['Authorization']) {
      console.warn(`[API] Missing Authorization header for protected endpoint: ${endpoint}`);
    }
  }
  
  const config: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...headers,
    },
  };
  
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, config);
  
  if (!response.ok) {
    let errorData: Partial<ApiErrorDetails> = {
      error: response.statusText,
      code: 'UNKNOWN',
      traceId: 'unknown',
    };

    try {
      const json = await response.json();
      errorData = { ...errorData, ...json };
    } catch {
      try {
        const text = await response.text();
        errorData.detail = text;
      } catch {
      }
    }

    const apiError = new ApiError({
      success: false,
      error: errorData.error || response.statusText,
      code: errorData.code || (response.status === 401 ? 'AUTH_REQUIRED' : 'UNKNOWN'),
      traceId: errorData.traceId || 'unknown',
      detail: errorData.detail,
      stack: errorData.stack,
      status: response.status,
      endpoint,
    });

    if (isDev) {
      console.error(`[API ERROR] ${endpoint}`, {
        status: response.status,
        code: apiError.code,
        traceId: apiError.traceId,
        detail: apiError.detail,
      });
    }

    throw apiError;
  }
  
  return response.json();
}

export const apiGet = <T>(endpoint: string, headers?: Record<string, string>) => 
  api<T>(endpoint, { method: 'GET', headers });
export const apiPost = <T>(endpoint: string, body?: any, headers?: Record<string, string>) => 
  api<T>(endpoint, { method: 'POST', body, headers });
export const apiPut = <T>(endpoint: string, body?: any, headers?: Record<string, string>) => 
  api<T>(endpoint, { method: 'PUT', body, headers });
export const apiPatch = <T>(endpoint: string, body?: any, headers?: Record<string, string>) => 
  api<T>(endpoint, { method: 'PATCH', body, headers });
export const apiDelete = <T>(endpoint: string, headers?: Record<string, string>) => 
  api<T>(endpoint, { method: 'DELETE', headers });
