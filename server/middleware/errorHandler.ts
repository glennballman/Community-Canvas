import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { log } from '../index';

export interface ApiError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
  detail?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  traceId: string;
  detail?: string;
  stack?: string;
}

export function globalErrorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const traceId = randomUUID();
  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 401 ? 'AUTH_REQUIRED' : status === 403 ? 'FORBIDDEN' : 'INTERNAL');
  const message = err.message || 'Internal Server Error';
  const isDev = process.env.NODE_ENV !== 'production';

  log(`[ERROR] traceId=${traceId} ${req.method} ${req.path} status=${status} code=${code} message=${message}`, 'error');
  
  if (isDev && err.stack) {
    console.error(`[ERROR STACK] traceId=${traceId}\n${err.stack}`);
  }

  const response: ErrorResponse = {
    success: false,
    error: message,
    code,
    traceId,
  };

  if (isDev) {
    response.detail = err.detail || message;
    response.stack = err.stack;
  }

  res.status(status).json(response);
}

export function createApiError(
  message: string,
  status: number = 500,
  code?: string,
  detail?: string
): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
  error.detail = detail;
  return error;
}
