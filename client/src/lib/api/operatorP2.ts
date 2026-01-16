/**
 * P2 Operator API Client
 * Single source of truth for all /api/operator/p2/* calls
 */

export type P2Ok<T extends object> = { ok: true } & T;
export type P2Err = { ok: false; error: string };
export type P2Resp<T extends object> = P2Ok<T> | P2Err;

/**
 * Make a request to the P2 operator API
 * @param path - Path relative to /api/operator/p2 (e.g., "/emergency/runs/start")
 * @param init - Fetch options (method, body, etc.)
 * @returns Parsed response with ok: true and data fields
 * @throws Error if ok is false or response is invalid
 */
export async function operatorP2<T extends object>(
  path: string,
  init?: RequestInit
): Promise<P2Ok<T>> {
  const url = `/api/operator/p2${path}`;
  
  const headers: HeadersInit = {
    ...(init?.headers || {}),
  };
  
  if (init?.body && typeof init.body === 'string') {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });
  
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error(`Invalid JSON response from ${url}`);
  }
  
  if (typeof json !== 'object' || json === null) {
    throw new Error('Invalid server response');
  }
  
  const data = json as Record<string, unknown>;
  
  if (typeof data.ok !== 'boolean') {
    throw new Error('Invalid server response');
  }
  
  if (data.ok === false) {
    throw new Error((data.error as string) || 'Request failed');
  }
  
  return data as P2Ok<T>;
}

/**
 * Helper for GET requests
 */
export async function operatorP2Get<T extends object>(
  path: string,
  params?: Record<string, string | number>
): Promise<P2Ok<T>> {
  let url = path;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.set(key, String(value));
    });
    url = `${path}?${searchParams.toString()}`;
  }
  return operatorP2<T>(url, { method: 'GET' });
}

/**
 * Helper for POST requests with JSON body
 */
export async function operatorP2Post<T extends object>(
  path: string,
  body?: object
): Promise<P2Ok<T>> {
  return operatorP2<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}
