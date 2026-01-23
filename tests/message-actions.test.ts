/**
 * V3.5 Message Action Blocks - Integration Tests
 * 
 * Tests for POST /api/messages/:messageId/action endpoint.
 * Uses test auth bootstrap for authenticated requests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../server/db';
import { serviceQuery } from '../server/db/tenantDb';

const TEST_AUTH_SECRET = process.env.TEST_AUTH_SECRET || 'test-secret';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

interface TestContext {
  conversationId: string;
  messageWithActionBlockId: string;
  messageWithoutActionBlockId: string;
  expiredActionBlockMessageId: string;
  resolvedActionBlockMessageId: string;
  questionBlockMessageId: string;
  summaryBlockMessageId: string;
  participantPartyId: string;
  nonParticipantPartyId: string;
}

const ctx: TestContext = {} as TestContext;

async function makeRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: any,
  authHeader?: string
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers['X-TEST-AUTH'] = authHeader;
    headers['Cookie'] = `test_session=valid`;
  }
  
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  return {
    status: response.status,
    data: await response.json().catch(() => ({})),
  };
}

describe('Message Action Blocks API', () => {
  beforeAll(async () => {
    const tenantResult = await serviceQuery(`
      SELECT id FROM cc_tenants LIMIT 1
    `, []);
    
    if (tenantResult.rows.length === 0) {
      console.warn('No tenant found, skipping test setup');
      return;
    }
    
    const tenantId = tenantResult.rows[0].id;
    
    const partyResult = await serviceQuery(`
      SELECT id FROM cc_parties WHERE tenant_id = $1 LIMIT 1
    `, [tenantId]);
    
    if (partyResult.rows.length > 0) {
      ctx.participantPartyId = partyResult.rows[0].id;
    }
    
    const nonParticipantResult = await serviceQuery(`
      SELECT id FROM cc_parties WHERE tenant_id != $1 LIMIT 1
    `, [tenantId]);
    
    if (nonParticipantResult.rows.length > 0) {
      ctx.nonParticipantPartyId = nonParticipantResult.rows[0].id;
    }
    
    const convResult = await serviceQuery(`
      SELECT id, contractor_party_id FROM cc_conversations LIMIT 1
    `, []);
    
    if (convResult.rows.length > 0) {
      ctx.conversationId = convResult.rows[0].id;
      ctx.participantPartyId = ctx.participantPartyId || convResult.rows[0].contractor_party_id;
    }
  });

  afterAll(async () => {
  });

  describe('Authentication', () => {
    it('returns 401 without authentication', async () => {
      const fakeMessageId = '00000000-0000-0000-0000-000000000001';
      const response = await makeRequest('POST', `/api/messages/${fakeMessageId}/action`, {
        action: 'accept',
      });
      
      expect(response.status).toBe(401);
      expect(response.data.ok).toBe(false);
      expect(response.data.error?.code).toBe('error.auth.unauthenticated');
    });
  });

  describe('Input Validation', () => {
    it('returns 400 for invalid message ID format', async () => {
      const response = await makeRequest('POST', `/api/messages/not-a-uuid/action`, {
        action: 'accept',
      }, TEST_AUTH_SECRET);
      
      expect(response.status).toBe(400);
      expect(response.data.ok).toBe(false);
      expect(response.data.error?.code).toBe('error.request.invalid');
    });

    it('returns 400 for invalid action', async () => {
      const fakeMessageId = '00000000-0000-0000-0000-000000000001';
      const response = await makeRequest('POST', `/api/messages/${fakeMessageId}/action`, {
        action: 'invalid_action',
      }, TEST_AUTH_SECRET);
      
      expect(response.status).toBe(400);
      expect(response.data.ok).toBe(false);
      expect(response.data.error?.code).toBe('error.request.invalid');
    });
  });

  describe('ActionBlockV1Schema', () => {
    it('validates correct block structure', async () => {
      const { ActionBlockV1Schema } = await import('../server/schemas/actionBlocks');
      
      const validBlock = {
        version: 1,
        blockType: 'offer',
        domain: 'job',
        target_id: '00000000-0000-0000-0000-000000000001',
        status: 'pending',
        payload: { price: 100 },
        created_at: new Date().toISOString(),
      };
      
      const result = ActionBlockV1Schema.safeParse(validBlock);
      expect(result.success).toBe(true);
    });

    it('rejects invalid blockType', async () => {
      const { ActionBlockV1Schema } = await import('../server/schemas/actionBlocks');
      
      const invalidBlock = {
        version: 1,
        blockType: 'invalid_type',
        domain: 'job',
        target_id: '00000000-0000-0000-0000-000000000001',
        status: 'pending',
        payload: {},
        created_at: new Date().toISOString(),
      };
      
      const result = ActionBlockV1Schema.safeParse(invalidBlock);
      expect(result.success).toBe(false);
    });
  });

  describe('validateActionForBlockType', () => {
    it('allows accept for offer blockType', async () => {
      const { validateActionForBlockType } = await import('../server/schemas/actionBlocks');
      expect(validateActionForBlockType('offer', 'accept')).toBe(true);
    });

    it('allows decline for offer blockType', async () => {
      const { validateActionForBlockType } = await import('../server/schemas/actionBlocks');
      expect(validateActionForBlockType('offer', 'decline')).toBe(true);
    });

    it('rejects accept for summary blockType', async () => {
      const { validateActionForBlockType } = await import('../server/schemas/actionBlocks');
      expect(validateActionForBlockType('summary', 'accept')).toBe(false);
    });

    it('rejects any action for deposit_request blockType', async () => {
      const { validateActionForBlockType } = await import('../server/schemas/actionBlocks');
      expect(validateActionForBlockType('deposit_request', 'accept')).toBe(false);
      expect(validateActionForBlockType('deposit_request', 'decline')).toBe(false);
      expect(validateActionForBlockType('deposit_request', 'answer')).toBe(false);
    });

    it('allows answer for question blockType', async () => {
      const { validateActionForBlockType } = await import('../server/schemas/actionBlocks');
      expect(validateActionForBlockType('question', 'answer')).toBe(true);
    });

    it('allows acknowledge for cancellation blockType', async () => {
      const { validateActionForBlockType } = await import('../server/schemas/actionBlocks');
      expect(validateActionForBlockType('cancellation', 'acknowledge')).toBe(true);
    });

    it('allows counter for change_request blockType', async () => {
      const { validateActionForBlockType } = await import('../server/schemas/actionBlocks');
      expect(validateActionForBlockType('change_request', 'counter')).toBe(true);
    });
  });

  describe('mapActionToStatus', () => {
    it('maps accept to accepted', async () => {
      const { mapActionToStatus } = await import('../server/schemas/actionBlocks');
      expect(mapActionToStatus('accept')).toBe('accepted');
    });

    it('maps decline to declined', async () => {
      const { mapActionToStatus } = await import('../server/schemas/actionBlocks');
      expect(mapActionToStatus('decline')).toBe('declined');
    });

    it('maps acknowledge to informational', async () => {
      const { mapActionToStatus } = await import('../server/schemas/actionBlocks');
      expect(mapActionToStatus('acknowledge')).toBe('informational');
    });

    it('maps answer to informational', async () => {
      const { mapActionToStatus } = await import('../server/schemas/actionBlocks');
      expect(mapActionToStatus('answer')).toBe('informational');
    });

    it('maps counter to pending', async () => {
      const { mapActionToStatus } = await import('../server/schemas/actionBlocks');
      expect(mapActionToStatus('counter')).toBe('pending');
    });
  });

  describe('isActionBlockExpired', () => {
    it('returns false when no expires_at', async () => {
      const { isActionBlockExpired } = await import('../server/schemas/actionBlocks');
      
      const block = {
        version: 1 as const,
        blockType: 'offer' as const,
        domain: 'job' as const,
        target_id: '00000000-0000-0000-0000-000000000001',
        status: 'pending' as const,
        payload: {},
        created_at: new Date().toISOString(),
      };
      
      expect(isActionBlockExpired(block)).toBe(false);
    });

    it('returns true when expires_at is in the past', async () => {
      const { isActionBlockExpired } = await import('../server/schemas/actionBlocks');
      
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const block = {
        version: 1 as const,
        blockType: 'offer' as const,
        domain: 'job' as const,
        target_id: '00000000-0000-0000-0000-000000000001',
        status: 'pending' as const,
        payload: {},
        created_at: new Date().toISOString(),
        expires_at: pastDate,
      };
      
      expect(isActionBlockExpired(block)).toBe(true);
    });

    it('returns false when expires_at is in the future', async () => {
      const { isActionBlockExpired } = await import('../server/schemas/actionBlocks');
      
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const block = {
        version: 1 as const,
        blockType: 'offer' as const,
        domain: 'job' as const,
        target_id: '00000000-0000-0000-0000-000000000001',
        status: 'pending' as const,
        payload: {},
        created_at: new Date().toISOString(),
        expires_at: futureDate,
      };
      
      expect(isActionBlockExpired(block)).toBe(false);
    });
  });

  describe('MarketMode Policy', () => {
    it('allows accept for provider on TARGETED request', async () => {
      const { ensureMarketActionAllowed } = await import('../server/policy/marketModePolicy');
      
      const result = ensureMarketActionAllowed({
        actorRole: 'provider',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        actionId: 'accept_request',
        objectType: 'service_request',
        objectStatus: 'AWAITING_RESPONSE',
        hasTargetProvider: true,
      });
      
      expect(result.allowed).toBe(true);
    });

    it('blocks decline for provider on CLOSED request', async () => {
      const { ensureMarketActionAllowed } = await import('../server/policy/marketModePolicy');
      
      const result = ensureMarketActionAllowed({
        actorRole: 'provider',
        marketMode: 'CLOSED',
        visibility: 'PRIVATE',
        actionId: 'decline_request',
        objectType: 'service_request',
        objectStatus: 'AWAITING_RESPONSE',
        hasTargetProvider: false,
      });
      
      expect(result.allowed).toBe(false);
    });
  });
});
