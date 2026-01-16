/**
 * P2 Operator API Client
 * Single source of truth for all /api/operator/p2/* calls
 */

export type P2Ok<T extends object> = { ok: true } & T;
export type P2Err = { ok: false; error: string };
export type P2Resp<T extends object> = P2Ok<T> | P2Err;

/**
 * Typed error class for P2 API errors
 */
export class P2ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  
  constructor(message: string, code: string = 'P2_ERROR', statusCode: number = 400) {
    super(message);
    this.name = 'P2ApiError';
    this.code = code;
    this.statusCode = statusCode;
  }
  
  static fromResponse(data: { error?: string; code?: string }, statusCode: number): P2ApiError {
    return new P2ApiError(
      data.error || 'Request failed',
      data.code || 'P2_ERROR',
      statusCode
    );
  }
}

/**
 * Make a request to the P2 operator API
 * @param path - Path relative to /api/operator/p2 (e.g., "/emergency/runs/start")
 * @param init - Fetch options (method, body, etc.)
 * @returns Parsed response with ok: true and data fields
 * @throws P2ApiError if ok is false or response is invalid
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
    throw new P2ApiError(`Invalid JSON response from ${url}`, 'INVALID_RESPONSE', response.status);
  }
  
  if (typeof json !== 'object' || json === null) {
    throw new P2ApiError('Invalid server response', 'INVALID_RESPONSE', response.status);
  }
  
  const data = json as Record<string, unknown>;
  
  if (typeof data.ok !== 'boolean') {
    throw new P2ApiError('Invalid server response', 'INVALID_RESPONSE', response.status);
  }
  
  if (data.ok === false) {
    throw P2ApiError.fromResponse(
      data as { error?: string; code?: string },
      response.status
    );
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
