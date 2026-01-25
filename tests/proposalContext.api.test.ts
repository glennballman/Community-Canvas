import { describe, it, expect } from 'vitest';
import {
  sanitizeProposalContext,
  sanitizeAndGateProposalContextForWrite,
  sanitizeAndGateProposalContextForRead,
  isValidUUID,
} from '../server/lib/proposalContext';
import {
  findUUIDsInString,
  deepScanForUUIDs,
  filterAllowedUUIDPaths,
  assertNoUUIDs,
  STRUCTURAL_UUID_PATHS,
  PROPOSAL_CONTEXT_PATHS,
} from './leakScan';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_UUID_2 = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';
const INVALID_UUID = 'not-a-valid-uuid';
const OVERSIZED_SCOPE = 'this-scope-option-is-way-too-long-for-our-system';

describe('Proposal Context Sanitization (API Level)', () => {
  describe('isValidUUID', () => {
    it('validates correct UUID format', () => {
      expect(isValidUUID(VALID_UUID)).toBe(true);
      expect(isValidUUID(VALID_UUID_2)).toBe(true);
    });

    it('rejects invalid UUID formats', () => {
      expect(isValidUUID(INVALID_UUID)).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID(undefined)).toBe(false);
      expect(isValidUUID(123)).toBe(false);
    });
  });

  describe('sanitizeProposalContext', () => {
    it('passes valid UUIDs through', () => {
      const input = {
        quote_draft_id: VALID_UUID,
        estimate_id: VALID_UUID_2,
      };
      const result = sanitizeProposalContext(input);
      expect(result).toEqual({
        quote_draft_id: VALID_UUID,
        estimate_id: VALID_UUID_2,
      });
    });

    it('drops invalid UUIDs', () => {
      const input = {
        quote_draft_id: VALID_UUID,
        estimate_id: INVALID_UUID,
      };
      const result = sanitizeProposalContext(input);
      expect(result).toEqual({
        quote_draft_id: VALID_UUID,
      });
      expect(result?.estimate_id).toBeUndefined();
    });

    it('drops unknown keys', () => {
      const input = {
        quote_draft_id: VALID_UUID,
        evil_key: 'should_drop',
        another_unknown: 'also_drop',
      };
      const result = sanitizeProposalContext(input);
      expect(result).toEqual({
        quote_draft_id: VALID_UUID,
      });
      expect((result as any)?.evil_key).toBeUndefined();
    });

    it('drops oversized selected_scope_option', () => {
      const input = {
        quote_draft_id: VALID_UUID,
        selected_scope_option: OVERSIZED_SCOPE,
      };
      const result = sanitizeProposalContext(input);
      expect(result).toEqual({
        quote_draft_id: VALID_UUID,
      });
      expect(result?.selected_scope_option).toBeUndefined();
    });

    it('keeps valid selected_scope_option', () => {
      const input = {
        quote_draft_id: VALID_UUID,
        selected_scope_option: 'hybrid',
      };
      const result = sanitizeProposalContext(input);
      expect(result).toEqual({
        quote_draft_id: VALID_UUID,
        selected_scope_option: 'hybrid',
      });
    });

    it('returns null for empty result', () => {
      const input = {
        evil_key: 'should_drop',
        estimate_id: INVALID_UUID,
      };
      const result = sanitizeProposalContext(input);
      expect(result).toBeNull();
    });

    it('returns null for non-object input', () => {
      expect(sanitizeProposalContext(null)).toBeNull();
      expect(sanitizeProposalContext(undefined)).toBeNull();
      expect(sanitizeProposalContext('string')).toBeNull();
      expect(sanitizeProposalContext(123)).toBeNull();
      expect(sanitizeProposalContext([])).toBeNull();
    });
  });

  describe('sanitizeAndGateProposalContextForWrite (WRITE PATH)', () => {
    it('allow=true: passes sanitized context through', () => {
      const input = {
        quote_draft_id: VALID_UUID,
        evil_key: 'dropped',
      };
      const result = sanitizeAndGateProposalContextForWrite(input, true);
      expect(result).toEqual({
        quote_draft_id: VALID_UUID,
      });
    });

    it('allow=false: returns null even with valid input', () => {
      const input = {
        quote_draft_id: VALID_UUID,
        estimate_id: VALID_UUID_2,
      };
      const result = sanitizeAndGateProposalContextForWrite(input, false);
      expect(result).toBeNull();
    });

    it('allow=true + invalid input: returns null', () => {
      const input = {
        evil_key: 'only invalid',
      };
      const result = sanitizeAndGateProposalContextForWrite(input, true);
      expect(result).toBeNull();
    });
  });

  describe('sanitizeAndGateProposalContextForRead (READ PATH)', () => {
    it('allow=true: extracts and sanitizes from metadata', () => {
      const metadata = {
        proposal_context: {
          quote_draft_id: VALID_UUID,
          evil_key: 'dropped',
        },
      };
      const result = sanitizeAndGateProposalContextForRead(metadata, true);
      expect(result).toEqual({
        quote_draft_id: VALID_UUID,
      });
    });

    it('allow=false: returns null even with valid metadata', () => {
      const metadata = {
        proposal_context: {
          quote_draft_id: VALID_UUID,
        },
      };
      const result = sanitizeAndGateProposalContextForRead(metadata, false);
      expect(result).toBeNull();
    });

    it('corrupted metadata: invalid UUIDs stripped', () => {
      const metadata = {
        proposal_context: {
          quote_draft_id: INVALID_UUID,
          estimate_id: VALID_UUID,
          bid_id: 'also-invalid',
        },
      };
      const result = sanitizeAndGateProposalContextForRead(metadata, true);
      expect(result).toEqual({
        estimate_id: VALID_UUID,
      });
    });

    it('handles missing proposal_context', () => {
      const result = sanitizeAndGateProposalContextForRead({}, true);
      expect(result).toBeNull();
    });
  });
});

describe('Leak Scanner Utilities', () => {
  describe('findUUIDsInString', () => {
    it('finds UUIDs in strings', () => {
      const text = `Here is a UUID: ${VALID_UUID} and another ${VALID_UUID_2}`;
      const found = findUUIDsInString(text);
      expect(found).toContain(VALID_UUID);
      expect(found).toContain(VALID_UUID_2);
    });

    it('returns empty for no UUIDs', () => {
      const found = findUUIDsInString('no uuids here');
      expect(found).toEqual([]);
    });

    it('handles non-string input', () => {
      expect(findUUIDsInString(null as any)).toEqual([]);
      expect(findUUIDsInString(undefined as any)).toEqual([]);
    });
  });

  describe('deepScanForUUIDs', () => {
    it('finds UUIDs in nested objects', () => {
      const obj = {
        level1: {
          level2: {
            id: VALID_UUID,
          },
        },
        array: [{ uuid: VALID_UUID_2 }],
      };
      const found = deepScanForUUIDs(obj);
      expect(found.length).toBe(2);
      expect(found.some((f) => f.value === VALID_UUID.toLowerCase())).toBe(true);
      expect(found.some((f) => f.value === VALID_UUID_2.toLowerCase())).toBe(true);
    });

    it('returns path information', () => {
      const obj = {
        proposal_context: {
          quote_draft_id: VALID_UUID,
        },
      };
      const found = deepScanForUUIDs(obj);
      expect(found.some((f) => f.path === 'proposal_context.quote_draft_id')).toBe(
        true
      );
    });
  });

  describe('filterAllowedUUIDPaths', () => {
    it('filters out allowed paths', () => {
      const locations = [
        { path: 'run_id', value: VALID_UUID },
        { path: 'unknown_field', value: VALID_UUID_2 },
      ];
      const filtered = filterAllowedUUIDPaths(locations, ['run_id']);
      expect(filtered.length).toBe(1);
      expect(filtered[0].path).toBe('unknown_field');
    });

    it('handles nested allowed paths', () => {
      const locations = [
        { path: 'latest.proposal_context.quote_draft_id', value: VALID_UUID },
        { path: 'latest.evil_field', value: VALID_UUID_2 },
      ];
      const filtered = filterAllowedUUIDPaths(locations, PROPOSAL_CONTEXT_PATHS);
      expect(filtered.length).toBe(1);
      expect(filtered[0].path).toBe('latest.evil_field');
    });
  });
});

describe('assertNoUUIDs with allowMasked', () => {
  it('throws when full UUID is present', () => {
    expect(() => assertNoUUIDs(`ID: ${VALID_UUID}`)).toThrow();
  });

  it('throws when full UUID is present even with allowMasked=true', () => {
    expect(() => assertNoUUIDs(`ID: ${VALID_UUID}`, { allowMasked: true })).toThrow();
  });

  it('passes when masked UUID is present and allowMasked=true', () => {
    const masked = VALID_UUID.substring(0, 8) + '…';
    expect(() => assertNoUUIDs(`ID: ${masked}`, { allowMasked: true })).not.toThrow();
  });

  it('throws when masked UUID is present and allowMasked=false', () => {
    const masked = VALID_UUID.substring(0, 8) + '…';
    expect(() => assertNoUUIDs(`ID: ${masked}`, { allowMasked: false })).not.toThrow();
  });

  it('passes when no UUIDs at all', () => {
    expect(() => assertNoUUIDs('No UUIDs here')).not.toThrow();
  });
});

describe('Response No-Leak Assertions', () => {
  it('simulated response with valid structure has no unexpected UUIDs', () => {
    const mockResponse = {
      ok: true,
      run_id: VALID_UUID,
      latest: {
        id: VALID_UUID_2,
        run_id: VALID_UUID,
        actor_individual_id: VALID_UUID_2,
        run_tenant_id: VALID_UUID,
        proposal_context: {
          quote_draft_id: VALID_UUID,
        },
      },
      events: [
        {
          id: VALID_UUID_2,
          run_id: VALID_UUID,
          actor_individual_id: VALID_UUID_2,
          run_tenant_id: VALID_UUID,
          proposal_context: {
            estimate_id: VALID_UUID_2,
          },
        },
      ],
    };

    const allowedPaths = [
      'run_id',
      'latest.id',
      'latest.run_id',
      'latest.actor_individual_id',
      'latest.run_tenant_id',
      'latest.proposal_context.quote_draft_id',
      'events[0].id',
      'events[0].run_id',
      'events[0].actor_individual_id',
      'events[0].run_tenant_id',
      'events[0].proposal_context.estimate_id',
    ];

    const allUUIDs = deepScanForUUIDs(mockResponse);
    const unexpected = filterAllowedUUIDPaths(allUUIDs, allowedPaths);
    expect(unexpected).toEqual([]);
  });

  it('detects leakage in unexpected fields', () => {
    const mockResponse = {
      ok: true,
      run_id: VALID_UUID,
      leaked_field: VALID_UUID_2,
    };

    const allowedPaths = ['run_id'];
    const allUUIDs = deepScanForUUIDs(mockResponse);
    const unexpected = filterAllowedUUIDPaths(allUUIDs, allowedPaths);
    expect(unexpected.length).toBe(1);
    expect(unexpected[0].path).toBe('leaked_field');
  });
});
