import { z } from 'zod';
import { insertSnapshotSchema, snapshots } from './schema';

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
  snapshots: {
    getLatest: {
      method: 'GET' as const,
      path: '/api/snapshots/latest',
      input: z.object({
        location: z.string().default('Vancouver')
      }),
      responses: {
        200: z.custom<typeof snapshots.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    refresh: {
      method: 'POST' as const,
      path: '/api/refresh',
      input: z.object({
        location: z.string().default('Vancouver')
      }),
      responses: {
        200: z.object({ success: z.boolean(), message: z.string() }),
        400: errorSchemas.validation,
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
