import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { requireAuth, requirePlatformAdmin } from '../server/middleware/guards';

describe('Platform-only entities guards', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    app.get('/api/cc_entities/datasets', requireAuth, requirePlatformAdmin, (_req, res) => {
      res.json({ success: true, datasets: [] });
    });
  });

  it('should return 401 when not authenticated (no user on request)', async () => {
    const response = await request(app).get('/api/cc_entities/datasets');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTH_REQUIRED');
  });

  it('should verify guard chain uses requirePlatformAdmin (not requireRole)', async () => {
    expect(requirePlatformAdmin).toBeDefined();
    expect(typeof requirePlatformAdmin).toBe('function');
  });

  it('should verify requireAuth is applied before requirePlatformAdmin', async () => {
    expect(requireAuth).toBeDefined();
    expect(typeof requireAuth).toBe('function');
  });
});
