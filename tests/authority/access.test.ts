/**
 * P2.9 Authority / Adjuster Read-Only Portals - Tests
 * Tests for token validation, passcode enforcement, scope enforcement, revocation, rate limiting
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../server/db';
import {
  generateRawToken,
  hashToken,
  hashPasscode,
  verifyPasscode,
  createSessionToken,
  verifySessionToken,
  checkRateLimit,
  cleanupRateLimits,
  createGrant,
  getGrant,
  listGrants,
  revokeGrant,
  addScope,
  listScopes,
  createToken,
  revokeToken,
  validateToken,
  createSession,
  buildShareUrl,
} from '../../server/lib/authority/access';

// Use existing test tenant from database
const TEST_TENANT_ID = 'd0000000-0000-0000-0000-000000000001';

describe('P2.9 Authority Access Portals', () => {
  let testGrantId: string;
  let testTokenId: string;
  let testRawToken: string;
  
  beforeAll(async () => {
    // Enable service mode for test setup
    await pool.query("SELECT set_config('app.service_mode', 'true', false)");
    
    // Clean up any previous test data
    await pool.query(
      `DELETE FROM cc_authority_access_grants WHERE tenant_id = $1::uuid AND title LIKE 'Test %'`,
      [TEST_TENANT_ID]
    );
  });
  
  afterAll(async () => {
    // Clean up test data
    await pool.query("SELECT set_config('app.service_mode', 'true', false)");
    await pool.query(
      `DELETE FROM cc_authority_access_grants WHERE tenant_id = $1::uuid AND title LIKE 'Test %'`,
      [TEST_TENANT_ID]
    );
    await pool.query("SELECT set_config('app.service_mode', 'false', false)");
  });
  
  describe('Token Generation & Hashing', () => {
    it('should generate unique random tokens', () => {
      const token1 = generateRawToken();
      const token2 = generateRawToken();
      
      expect(token1).toBeDefined();
      expect(token1.length).toBeGreaterThan(20);
      expect(token1).not.toBe(token2);
    });
    
    it('should hash tokens consistently', () => {
      const token = generateRawToken();
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA256 hex
    });
    
    it('should hash and verify passcodes', async () => {
      const passcode = 'secret123';
      const hash = await hashPasscode(passcode);
      
      expect(hash).not.toBe(passcode);
      expect(await verifyPasscode(passcode, hash)).toBe(true);
      expect(await verifyPasscode('wrongpass', hash)).toBe(false);
    });
  });
  
  describe('Session Token Management', () => {
    it('should create and verify session tokens', () => {
      const session = {
        tenantId: TEST_TENANT_ID,
        grantId: 'g0000000-0000-0000-0000-000000000001',
        tokenId: 't0000000-0000-0000-0000-000000000001',
        exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
      };
      
      const token = createSessionToken(session);
      expect(token).toBeDefined();
      
      const decoded = verifySessionToken(token);
      expect(decoded).toBeDefined();
      expect(decoded!.tenantId).toBe(session.tenantId);
      expect(decoded!.grantId).toBe(session.grantId);
    });
    
    it('should reject expired session tokens', () => {
      const session = {
        tenantId: TEST_TENANT_ID,
        grantId: 'g0000000-0000-0000-0000-000000000001',
        tokenId: 't0000000-0000-0000-0000-000000000001',
        exp: Math.floor(Date.now() / 1000) - 60, // Expired 1 minute ago
      };
      
      const token = createSessionToken(session);
      const decoded = verifySessionToken(token);
      expect(decoded).toBeNull();
    });
  });
  
  describe('Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const ip = '192.168.1.100';
      const tokenHash = 'test-hash-rate-limit-1';
      
      // First request should be allowed
      const result1 = checkRateLimit(ip, tokenHash);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBeGreaterThan(0);
    });
    
    it('should block requests after exceeding limit', () => {
      const ip = '192.168.1.101';
      const tokenHash = 'test-hash-rate-limit-2';
      
      // Exceed the limit (30 requests)
      for (let i = 0; i < 35; i++) {
        const result = checkRateLimit(ip, tokenHash);
        if (i >= 30) {
          expect(result.allowed).toBe(false);
          expect(result.remaining).toBe(0);
        }
      }
    });
    
    it('should clean up expired rate limit entries', () => {
      // Just verify cleanup doesn't throw
      cleanupRateLimits();
    });
  });
  
  describe('Grant Management', () => {
    it('should create a grant', async () => {
      const grant = await createGrant({
        tenantId: TEST_TENANT_ID,
        grantType: 'adjuster',
        title: 'Test Adjuster Grant',
        description: 'Test grant for adjuster access',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        maxViews: 10,
        requirePasscode: false,
      });
      
      testGrantId = grant.id;
      
      expect(grant).toBeDefined();
      expect(grant.id).toBeDefined();
      expect(grant.grantType).toBe('adjuster');
      expect(grant.status).toBe('active');
      expect(grant.maxViews).toBe(10);
    });
    
    it('should get a grant by ID', async () => {
      const grant = await getGrant(TEST_TENANT_ID, testGrantId);
      
      expect(grant).toBeDefined();
      expect(grant!.id).toBe(testGrantId);
      expect(grant!.title).toBe('Test Adjuster Grant');
    });
    
    it('should list grants for tenant', async () => {
      const grants = await listGrants(TEST_TENANT_ID);
      
      expect(grants.length).toBeGreaterThan(0);
      expect(grants.some(g => g.id === testGrantId)).toBe(true);
    });
  });
  
  describe('Scope Management', () => {
    it('should add a scope to a grant', async () => {
      // Use a valid fake UUID (we don't have real evidence bundles in test)
      const scopeId = '50000000-0000-0000-0000-000000000001';
      
      const scope = await addScope({
        tenantId: TEST_TENANT_ID,
        grantId: testGrantId,
        scopeType: 'evidence_bundle',
        scopeId: scopeId,
        label: 'Test Bundle',
        notes: 'Test scope for testing',
      });
      
      expect(scope).toBeDefined();
      expect(scope.grantId).toBe(testGrantId);
      expect(scope.scopeType).toBe('evidence_bundle');
    });
    
    it('should list scopes for a grant', async () => {
      const scopes = await listScopes(TEST_TENANT_ID, testGrantId);
      
      expect(scopes.length).toBeGreaterThan(0);
      expect(scopes[0].scopeType).toBe('evidence_bundle');
    });
  });
  
  describe('Token Management', () => {
    it('should create a token for a grant', async () => {
      const { token, rawToken } = await createToken({
        tenantId: TEST_TENANT_ID,
        grantId: testGrantId,
      });
      
      testTokenId = token.id;
      testRawToken = rawToken;
      
      expect(token).toBeDefined();
      expect(token.grantId).toBe(testGrantId);
      expect(token.status).toBe('active');
      expect(rawToken).toBeDefined();
      expect(rawToken.length).toBeGreaterThan(20);
    });
    
    it('should build share URL', () => {
      const url = buildShareUrl(testRawToken, 'https://example.com');
      expect(url).toContain('/p/authority?token=');
      expect(url).toContain(encodeURIComponent(testRawToken));
    });
  });
  
  describe('Token Validation', () => {
    it('should validate a valid token', async () => {
      const result = await validateToken(testRawToken);
      
      expect(result.ok).toBe(true);
      expect(result.tenantId).toBe(TEST_TENANT_ID);
      expect(result.grantId).toBe(testGrantId);
      expect(result.scopes).toBeDefined();
    });
    
    it('should reject an invalid token', async () => {
      const result = await validateToken('invalid-token-does-not-exist');
      
      expect(result.ok).toBe(false);
      expect(result.tenantId).toBeUndefined();
    });
    
    it('should create a session from validation result', async () => {
      const validation = await validateToken(testRawToken);
      expect(validation.ok).toBe(true);
      
      const { sessionToken, expiresAt } = createSession(validation);
      
      expect(sessionToken).toBeDefined();
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
  
  describe('Passcode Enforcement', () => {
    let passcodeGrantId: string;
    let passcodeRawToken: string;
    
    it('should create a grant with passcode requirement', async () => {
      const grant = await createGrant({
        tenantId: TEST_TENANT_ID,
        grantType: 'insurer',
        title: 'Test Passcode Grant',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        requirePasscode: true,
        passcode: 'secret1234',
      });
      
      passcodeGrantId = grant.id;
      
      expect(grant.requirePasscode).toBe(true);
      expect(grant.passcodeHash).toBeDefined();
    });
    
    it('should create token for passcode grant', async () => {
      const { rawToken } = await createToken({
        tenantId: TEST_TENANT_ID,
        grantId: passcodeGrantId,
      });
      
      passcodeRawToken = rawToken;
      expect(passcodeRawToken).toBeDefined();
    });
    
    it('should reject access without passcode', async () => {
      const result = await validateToken(passcodeRawToken);
      expect(result.ok).toBe(false);
    });
    
    it('should reject access with wrong passcode', async () => {
      const result = await validateToken(passcodeRawToken, 'wrongpasscode');
      expect(result.ok).toBe(false);
    });
    
    it('should allow access with correct passcode', async () => {
      const result = await validateToken(passcodeRawToken, 'secret1234');
      expect(result.ok).toBe(true);
      expect(result.grantId).toBe(passcodeGrantId);
    });
  });
  
  describe('Revocation', () => {
    let revokeTestTokenId: string;
    let revokeTestRawToken: string;
    
    it('should create a token to revoke', async () => {
      const { token, rawToken } = await createToken({
        tenantId: TEST_TENANT_ID,
        grantId: testGrantId,
      });
      
      revokeTestTokenId = token.id;
      revokeTestRawToken = rawToken;
      
      // Verify it works before revocation
      const result = await validateToken(revokeTestRawToken);
      expect(result.ok).toBe(true);
    });
    
    it('should revoke a token', async () => {
      await revokeToken(TEST_TENANT_ID, revokeTestTokenId, null, 'Test revocation');
      
      // Verify it's now rejected
      const result = await validateToken(revokeTestRawToken);
      expect(result.ok).toBe(false);
    });
    
    it('should revoke a grant and all its tokens', async () => {
      // Create a new grant with token
      const grant = await createGrant({
        tenantId: TEST_TENANT_ID,
        grantType: 'legal',
        title: 'Test Grant to Revoke',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      
      const { rawToken } = await createToken({
        tenantId: TEST_TENANT_ID,
        grantId: grant.id,
      });
      
      // Verify it works
      let result = await validateToken(rawToken);
      expect(result.ok).toBe(true);
      
      // Revoke the grant
      await revokeGrant(TEST_TENANT_ID, grant.id, null, 'Test grant revocation');
      
      // Verify token is now rejected
      result = await validateToken(rawToken);
      expect(result.ok).toBe(false);
    });
  });
  
  describe('Expiry Enforcement', () => {
    it('should reject expired tokens', async () => {
      // Create a grant that expires in the past (we'll need to insert directly)
      const result = await pool.query<any>(
        `INSERT INTO cc_authority_access_grants (
          tenant_id, grant_type, title, expires_at
        ) VALUES ($1::uuid, 'generic', 'Test Expired Grant', $2)
        RETURNING id`,
        [TEST_TENANT_ID, new Date(Date.now() - 1000)] // 1 second ago
      );
      
      const expiredGrantId = result.rows[0].id;
      
      // Create token (also expired)
      const rawToken = generateRawToken();
      const tokenHash = hashToken(rawToken);
      
      await pool.query(
        `INSERT INTO cc_authority_access_tokens (
          tenant_id, grant_id, token_hash, expires_at
        ) VALUES ($1::uuid, $2::uuid, $3, $4)`,
        [TEST_TENANT_ID, expiredGrantId, tokenHash, new Date(Date.now() - 1000)]
      );
      
      // Validate should fail
      const validation = await validateToken(rawToken);
      expect(validation.ok).toBe(false);
    });
  });
  
  describe('Events Append-Only', () => {
    it('should log events and prevent modification', async () => {
      // Get an event from our test grant
      const events = await pool.query<any>(
        `SELECT * FROM cc_authority_access_events 
         WHERE tenant_id = $1::uuid AND grant_id = $2::uuid 
         ORDER BY event_at DESC LIMIT 1`,
        [TEST_TENANT_ID, testGrantId]
      );
      
      expect(events.rows.length).toBeGreaterThan(0);
      
      const eventId = events.rows[0].id;
      
      // Attempt to update (should fail)
      try {
        await pool.query(
          `UPDATE cc_authority_access_events SET event_type = 'hacked' WHERE id = $1::uuid`,
          [eventId]
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('AUTHORITY_EVENTS_IMMUTABLE');
      }
      
      // Attempt to delete (should fail)
      try {
        await pool.query(
          `DELETE FROM cc_authority_access_events WHERE id = $1::uuid`,
          [eventId]
        );
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('AUTHORITY_EVENTS_IMMUTABLE');
      }
    });
  });
});
