import { describe, it, expect } from 'vitest';
import { ENTRY_POINT_COPY, REQUIRED_TOKEN_KEYS, type EntryPointType } from '../../client/src/copy/entryPointCopy';

describe('CopyInventory', () => {
  const entryPoints: EntryPointType[] = [
    'generic',
    'lodging',
    'parking',
    'marina',
    'restaurant',
    'equipment',
    'service',
    'activity',
  ];

  describe('Required token coverage', () => {
    for (const entryPoint of entryPoints) {
      it(`${entryPoint} has all required token keys`, () => {
        const copy = ENTRY_POINT_COPY[entryPoint];
        expect(copy).toBeDefined();

        const missingKeys: string[] = [];
        for (const key of REQUIRED_TOKEN_KEYS) {
          if (!copy[key]) {
            missingKeys.push(key);
          }
        }

        if (missingKeys.length > 0) {
          throw new Error(
            `Entry point "${entryPoint}" is missing required keys:\n  ${missingKeys.join('\n  ')}`
          );
        }
      });
    }
  });

  describe('Forbidden terms check', () => {
    const forbiddenTerms = [
      /\bcontractor\b/i,
      /\bbooking\b/i,
      /\bbooked\b/i,
      /\bbookings\b/i,
    ];

    for (const entryPoint of entryPoints) {
      it(`${entryPoint} contains no forbidden terms`, () => {
        const copy = ENTRY_POINT_COPY[entryPoint];
        const violations: string[] = [];

        for (const [key, value] of Object.entries(copy)) {
          for (const pattern of forbiddenTerms) {
            if (pattern.test(value)) {
              violations.push(`"${key}": "${value}" contains forbidden term matching ${pattern}`);
            }
          }
        }

        if (violations.length > 0) {
          throw new Error(
            `Entry point "${entryPoint}" contains forbidden terms:\n  ${violations.join('\n  ')}`
          );
        }
      });
    }
  });

  describe('Token value validation', () => {
    for (const entryPoint of entryPoints) {
      it(`${entryPoint} token values are non-empty strings`, () => {
        const copy = ENTRY_POINT_COPY[entryPoint];
        
        for (const [key, value] of Object.entries(copy)) {
          expect(typeof value).toBe('string');
          expect(value.trim().length).toBeGreaterThan(0);
        }
      });
    }

    it('all entry points use "reservation" not "booking"', () => {
      for (const entryPoint of entryPoints) {
        const copy = ENTRY_POINT_COPY[entryPoint];
        expect(copy['label.noun.reservation']).toBe('reservation');
      }
    });
  });

  describe('Message template interpolation placeholders', () => {
    const messageKeys = [
      'msg.invite.sent.body',
      'msg.request.accepted.body',
      'msg.proposal.created.body',
      'msg.request.declined.body',
      'msg.request.unassigned.body',
    ];

    for (const entryPoint of entryPoints) {
      it(`${entryPoint} message bodies contain {requestTitle} placeholder`, () => {
        const copy = ENTRY_POINT_COPY[entryPoint];
        
        for (const key of messageKeys) {
          const value = copy[key];
          expect(value).toContain('{requestTitle}');
        }
      });
    }
  });

  describe('Consistency checks', () => {
    it('all entry points have exactly the same keys as generic', () => {
      const genericKeys = Object.keys(ENTRY_POINT_COPY.generic).sort();
      
      for (const entryPoint of entryPoints) {
        if (entryPoint === 'generic') continue;
        
        const entryPointKeys = Object.keys(ENTRY_POINT_COPY[entryPoint]).sort();
        expect(entryPointKeys).toEqual(genericKeys);
      }
    });

    it('generic uses neutral terminology (no industry-specific nouns)', () => {
      const genericCopy = ENTRY_POINT_COPY.generic;
      
      expect(genericCopy['label.noun.provider']).toBe('provider');
      expect(genericCopy['label.noun.requester']).toBe('requester');
      expect(genericCopy['label.noun.request']).toBe('request');
    });
  });
});
