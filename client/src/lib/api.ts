/**
 * Centralized API helper - ALWAYS includes credentials
 * This fixes all 401 errors from missing cookies
 */

const API_BASE = '/api';

interface APIError extends Error {
  status?: number;
  code?: string;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    const error: APIError = new Error('Authentication required');
    error.status = 401;
    error.code = 'UNAUTHENTICATED';
    throw error;
  }

  if (res.status === 403) {
    const error: APIError = new Error('Access denied');
    error.status = 403;
    error.code = 'FORBIDDEN';
    throw error;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error: APIError = new Error(data.error || `Request failed: ${res.status}`);
    error.status = res.status;
    throw error;
  }

  const text = await res.text();
  if (!text) return {} as T;
  
  try {
    return JSON.parse(text);
  } catch {
    return text as unknown as T;
  }
}

export const api = {
  get: <T = any>(endpoint: string) => apiFetch<T>(endpoint),
  
  post: <T = any>(endpoint: string, body?: any) => 
    apiFetch<T>(endpoint, { 
      method: 'POST', 
      body: body ? JSON.stringify(body) : undefined 
    }),
  
  put: <T = any>(endpoint: string, body?: any) => 
    apiFetch<T>(endpoint, { 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined 
    }),
  
  patch: <T = any>(endpoint: string, body?: any) => 
    apiFetch<T>(endpoint, { 
      method: 'PATCH', 
      body: body ? JSON.stringify(body) : undefined 
    }),
  
  delete: <T = any>(endpoint: string) => 
    apiFetch<T>(endpoint, { method: 'DELETE' }),
};

export async function checkAuth(): Promise<{
  authenticated: boolean;
  user?: any;
  impersonating?: boolean;
  impersonation?: any;
}> {
  try {
    const data = await api.get('/auth/status');
    return {
      authenticated: true,
      ...data
    };
  } catch (error: any) {
    if (error.status === 401) {
      return { authenticated: false };
    }
    throw error;
  }
}

export async function getImpersonationStatus(): Promise<{
  is_impersonating: boolean;
  tenant_id?: string;
  tenant_name?: string;
  actor_party_id?: string;
  actor_display_name?: string;
  started_at?: string;
  expires_at?: string;
} | null> {
  try {
    return await api.get('/platform/impersonation/status');
  } catch {
    return null;
  }
}

export async function startImpersonation(params: {
  tenant_id: string;
  actor_party_id?: string;
  reason: string;
  duration_minutes: number;
}): Promise<{ success: boolean; session_id?: string; error?: string }> {
  return api.post('/platform/impersonation/start', params);
}

export async function stopImpersonation(): Promise<{ success: boolean }> {
  return api.post('/platform/impersonation/stop');
}
