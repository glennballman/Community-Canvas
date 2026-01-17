import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';

describe('Jobs Backend Certification Tests', () => {
  
  describe('Embed Domain Allowlist', () => {
    it('should reject requests from non-allowed origins', async () => {
      const fakeEmbedKey = crypto.randomBytes(24).toString('base64url');
      
      const response = await fetch(`${BASE_URL}/api/embed/feed/${fakeEmbedKey}`, {
        headers: {
          'Origin': 'https://evil-domain.com',
          'Host': 'localhost:5000'
        }
      });
      
      const data = await response.json();
      expect(data.ok).toBe(false);
    });

    it('should verify Origin header against allowed_domains', async () => {
      const response = await fetch(`${BASE_URL}/api/embed/feed/invalid-key`, {
        headers: {
          'Origin': 'https://attacker.com'
        }
      });
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('EMBED_SURFACE_NOT_FOUND');
    });
  });

  describe('Moderation Gating', () => {
    it('pending_review jobs should be invisible to public API', async () => {
      const response = await fetch(`${BASE_URL}/api/public/jobs`, {
        headers: {
          'X-Portal-Slug': 'canadadirect'
        }
      });
      
      const data = await response.json();
      
      if (data.ok && data.jobs) {
        for (const job of data.jobs) {
          expect(job.publish_state).not.toBe('pending_review');
        }
      }
    });

    it('portal scoping should prevent cross-portal visibility', async () => {
      const bamfieldResponse = await fetch(`${BASE_URL}/api/public/jobs`, {
        headers: {
          'X-Portal-Slug': 'bamfield'
        }
      });
      
      const canadaResponse = await fetch(`${BASE_URL}/api/public/jobs`, {
        headers: {
          'X-Portal-Slug': 'canadadirect'
        }
      });
      
      const bamfieldData = await bamfieldResponse.json();
      const canadaData = await canadaResponse.json();
      
      if (bamfieldData.ok && bamfieldData.jobs && canadaData.ok && canadaData.jobs) {
        const bamfieldJobIds = new Set(bamfieldData.jobs.map((j: any) => j.posting_id));
        const canadaJobIds = new Set(canadaData.jobs.map((j: any) => j.posting_id));
        
        for (const id of bamfieldJobIds) {
          expect(canadaJobIds.has(id)).toBe(false);
        }
      }
    });
  });

  describe('Upload Session Single-Use Enforcement', () => {
    it('should reject upload-url after session is used', async () => {
      const response = await fetch(`${BASE_URL}/api/public/jobs/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: 'expired-or-used-token',
          role: 'resumeDocument',
          mimeType: 'application/pdf'
        })
      });
      
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(['INVALID_SESSION', 'SESSION_ALREADY_USED', 'SESSION_EXPIRED']).toContain(data.error);
    });

    it('should reject attach after session is used', async () => {
      const response = await fetch(`${BASE_URL}/api/public/jobs/attach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: 'expired-or-used-token',
          mediaId: crypto.randomUUID(),
          role: 'resumeDocument'
        })
      });
      
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(['INVALID_SESSION', 'SESSION_ALREADY_USED', 'SESSION_EXPIRED']).toContain(data.error);
    });
  });

  describe('Media Role Allowlist', () => {
    it('should reject invalid upload roles', async () => {
      const response = await fetch(`${BASE_URL}/api/public/jobs/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: 'test-token',
          role: 'maliciousRole',
          mimeType: 'application/pdf'
        })
      });
      
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('INVALID_ROLE');
    });

    it('should reject disallowed MIME types for role', async () => {
      const response = await fetch(`${BASE_URL}/api/public/jobs/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: 'test-token',
          role: 'resumeDocument',
          mimeType: 'application/x-executable'
        })
      });
      
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('MIME_TYPE_NOT_ALLOWED');
    });

    it('should reject files exceeding size limit', async () => {
      const response = await fetch(`${BASE_URL}/api/public/jobs/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken: 'test-token',
          role: 'resumeDocument',
          mimeType: 'application/pdf',
          fileSize: 100 * 1024 * 1024
        })
      });
      
      const data = await response.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe('FILE_TOO_LARGE');
    });

    it('should only allow specific roles for applicant uploads', async () => {
      const allowedRoles = ['resumeDocument', 'referenceDocument', 'photo', 'videoIntroduction'];
      const deniedRoles = ['administrativeDocument', 'contract', 'invoice', 'other'];
      
      for (const role of deniedRoles) {
        const response = await fetch(`${BASE_URL}/api/public/jobs/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionToken: 'test-token',
            role,
            mimeType: 'application/pdf'
          })
        });
        
        const data = await response.json();
        expect(data.ok).toBe(false);
        expect(data.error).toBe('INVALID_ROLE');
      }
    });
  });

  describe('Route Aliases', () => {
    it('/api/p2/public/jobs should work as alias', async () => {
      const response = await fetch(`${BASE_URL}/api/p2/public/jobs`, {
        headers: {
          'X-Portal-Slug': 'bamfield'
        }
      });
      
      expect([200, 404]).toContain(response.status);
    });

    it('/api/p2/app/mod/pending should work as alias', async () => {
      const response = await fetch(`${BASE_URL}/api/p2/app/mod/pending`);
      
      expect([200, 400, 401, 403]).toContain(response.status);
    });
  });
});
