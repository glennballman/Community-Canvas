/**
 * V3.5 Copy Sync Test
 * 
 * Ensures server and client copy inventories are in sync
 */

import { describe, it, expect } from 'vitest';

import { 
  ENTRY_POINT_COPY as CLIENT_COPY,
  REQUIRED_TOKEN_KEYS as CLIENT_REQUIRED_KEYS,
} from '../../client/src/copy/entryPointCopy';

import {
  ENTRY_POINT_COPY as SERVER_COPY,
  REQUIRED_TOKEN_KEYS as SERVER_REQUIRED_KEYS,
} from '../../server/copy/entryPointCopy';

describe('V3.5 Copy Sync', () => {
  describe('Required token keys are in sync', () => {
    it('should have the same required token keys on client and server', () => {
      expect(CLIENT_REQUIRED_KEYS).toEqual(SERVER_REQUIRED_KEYS);
    });
  });

  describe('Entry point types are in sync', () => {
    it('should have the same entry point types on client and server', () => {
      const clientTypes = Object.keys(CLIENT_COPY).sort();
      const serverTypes = Object.keys(SERVER_COPY).sort();
      expect(clientTypes).toEqual(serverTypes);
    });
  });

  describe('Copy tokens are in sync for each entry point', () => {
    const entryPointTypes = Object.keys(CLIENT_COPY);

    entryPointTypes.forEach(entryPoint => {
      describe(`${entryPoint} entry point`, () => {
        it('should have the same token keys', () => {
          const clientKeys = Object.keys(CLIENT_COPY[entryPoint as keyof typeof CLIENT_COPY]).sort();
          const serverKeys = Object.keys(SERVER_COPY[entryPoint as keyof typeof SERVER_COPY]).sort();
          expect(clientKeys).toEqual(serverKeys);
        });

        it('should have the same token values', () => {
          const clientCopy = CLIENT_COPY[entryPoint as keyof typeof CLIENT_COPY];
          const serverCopy = SERVER_COPY[entryPoint as keyof typeof SERVER_COPY];
          
          for (const key of Object.keys(clientCopy)) {
            expect(serverCopy[key]).toBe(clientCopy[key]);
          }
        });
      });
    });
  });

  describe('No forbidden terms in copy defaults', () => {
    const forbiddenTerms = ['contractor', 'booking', 'booked', 'bookings'];
    const entryPointTypes = Object.keys(CLIENT_COPY);

    entryPointTypes.forEach(entryPoint => {
      describe(`${entryPoint} entry point`, () => {
        const copy = CLIENT_COPY[entryPoint as keyof typeof CLIENT_COPY];
        
        Object.entries(copy).forEach(([key, value]) => {
          forbiddenTerms.forEach(term => {
            it(`${key} should not contain "${term}"`, () => {
              expect(value.toLowerCase()).not.toContain(term);
            });
          });
        });
      });
    });
  });
});
