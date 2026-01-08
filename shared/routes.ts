import { z } from 'zod';
import { cc_snapshots, snapshotDataSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  cc_snapshots: {
    getLatest: {
      method: 'GET' as const,
      path: '/api/city/:cityName',
      responses: {
        200: z.object({
          success: z.boolean(),
          data: snapshotDataSchema,
          timestamp: z.string()
        }),
        404: errorSchemas.notFound,
      },
    },
    refresh: {
      method: 'POST' as const,
      path: '/api/refresh',
      input: z.object({
        location: z.string()
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        500: errorSchemas.internal
      }
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
