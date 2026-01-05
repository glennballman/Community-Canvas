/**
 * API UTILITIES
 * 
 * Centralized API calls with error handling.
 * DO NOT MODIFY THIS FILE.
 */

const API_BASE = '';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;
  
  const config: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  
  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export const apiGet = <T>(endpoint: string) => api<T>(endpoint, { method: 'GET' });
export const apiPost = <T>(endpoint: string, body?: any) => api<T>(endpoint, { method: 'POST', body });
export const apiPut = <T>(endpoint: string, body?: any) => api<T>(endpoint, { method: 'PUT', body });
export const apiDelete = <T>(endpoint: string) => api<T>(endpoint, { method: 'DELETE' });
