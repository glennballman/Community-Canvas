import { describe, it, expect } from 'vitest';
import { 
  resolveCopy, 
  ep, 
  createContext,
  createResolver,
  getNouns,
  getStateLabels,
  getUINotices,
  getCTAs,
  getMessageTemplates,
} from '../CopyResolver';
import type { CopyContext } from '../entryPointCopy';

describe('CopyResolver', () => {
  describe('ep() - EntryPoint type mapper', () => {
    it('returns generic for null/undefined', () => {
      expect(ep(null)).toBe('generic');
      expect(ep(undefined)).toBe('generic');
      expect(ep('')).toBe('generic');
    });

    it('returns valid entry point types as-is', () => {
      expect(ep('lodging')).toBe('lodging');
      expect(ep('parking')).toBe('parking');
      expect(ep('marina')).toBe('marina');
      expect(ep('restaurant')).toBe('restaurant');
      expect(ep('equipment')).toBe('equipment');
      expect(ep('service')).toBe('service');
      expect(ep('activity')).toBe('activity');
      expect(ep('generic')).toBe('generic');
    });

    it('handles case insensitivity', () => {
      expect(ep('LODGING')).toBe('lodging');
      expect(ep('Parking')).toBe('parking');
      expect(ep('MARINA')).toBe('marina');
    });

    it('returns generic for unknown types', () => {
      expect(ep('unknown')).toBe('generic');
      expect(ep('foo')).toBe('generic');
    });
  });

  describe('createContext()', () => {
    it('creates context with defaults', () => {
      const ctx = createContext('lodging');
      expect(ctx.entryPoint).toBe('lodging');
    });

    it('includes optional properties', () => {
      const ctx = createContext('marina', { portalTone: 'community', actorRole: 'provider' });
      expect(ctx.entryPoint).toBe('marina');
      expect(ctx.portalTone).toBe('community');
      expect(ctx.actorRole).toBe('provider');
    });
  });

  describe('resolveCopy()', () => {
    it('resolves entry-point-specific tokens', () => {
      const ctx: CopyContext = { entryPoint: 'lodging' };
      expect(resolveCopy('label.noun.provider', ctx)).toBe('host');
      expect(resolveCopy('label.noun.requester', ctx)).toBe('guest');
    });

    it('resolves generic tokens', () => {
      const ctx: CopyContext = { entryPoint: 'generic' };
      expect(resolveCopy('label.noun.provider', ctx)).toBe('provider');
      expect(resolveCopy('label.noun.requester', ctx)).toBe('requester');
    });

    it('falls back to generic for missing entry-point-specific tokens', () => {
      const ctx: CopyContext = { entryPoint: 'lodging' };
      expect(resolveCopy('state.market.OPEN.label', ctx)).toBe('Open');
    });

    it('returns [[key]] for completely missing tokens', () => {
      const ctx: CopyContext = { entryPoint: 'generic' };
      expect(resolveCopy('nonexistent.key', ctx)).toBe('[[nonexistent.key]]');
    });

    it('interpolates variables', () => {
      const ctx: CopyContext = { entryPoint: 'generic' };
      const result = resolveCopy('msg.invite.sent.body', ctx, { requestTitle: 'Test Request' });
      expect(result).toContain('Test Request');
      expect(result).not.toContain('{requestTitle}');
    });

    it('interpolates multiple variables', () => {
      const ctx: CopyContext = { entryPoint: 'lodging' };
      const result = resolveCopy('msg.request.accepted.body', ctx, { requestTitle: 'Beach House Stay' });
      expect(result).toContain('Beach House Stay');
    });
  });

  describe('createResolver()', () => {
    it('creates a bound resolver', () => {
      const ctx: CopyContext = { entryPoint: 'marina' };
      const resolve = createResolver(ctx);
      
      expect(resolve('label.noun.provider')).toBe('marina');
      expect(resolve('label.noun.requester')).toBe('boater');
    });

    it('bound resolver supports variables', () => {
      const ctx: CopyContext = { entryPoint: 'marina' };
      const resolve = createResolver(ctx);
      
      const result = resolve('msg.invite.sent.body', { requestTitle: 'Slip 42 Request' });
      expect(result).toContain('Slip 42 Request');
    });
  });

  describe('Helper functions', () => {
    it('getNouns() returns all noun labels', () => {
      const ctx: CopyContext = { entryPoint: 'parking' };
      const nouns = getNouns(ctx);
      
      expect(nouns.provider).toBe('lot operator');
      expect(nouns.requester).toBe('driver');
      expect(nouns.request).toBe('capacity request');
      expect(nouns.reservation).toBe('reservation');
    });

    it('getStateLabels() returns state labels', () => {
      const ctx: CopyContext = { entryPoint: 'generic' };
      const states = getStateLabels(ctx);
      
      expect(states.marketTargeted).toBe('Targeted');
      expect(states.marketOpen).toBe('Open');
      expect(states.requestUnassigned).toBe('Unassigned');
    });

    it('getUINotices() returns UI notice strings', () => {
      const ctx: CopyContext = { entryPoint: 'service' };
      const notices = getUINotices(ctx);
      
      expect(notices.marketLocked).toContain('not open for responses');
      expect(notices.askRequesterTitle).toBeTruthy();
    });

    it('getCTAs() returns call-to-action strings', () => {
      const ctx: CopyContext = { entryPoint: 'equipment' };
      const ctas = getCTAs(ctx);
      
      expect(ctas.proposalReview).toBe('Review Offer');
      expect(ctas.requestOpenToBids).toBe('Open for Offers');
    });

    it('getMessageTemplates() returns message subject/body pairs', () => {
      const ctx: CopyContext = { entryPoint: 'activity' };
      const messages = getMessageTemplates(ctx, { requestTitle: 'Kayak Tour' });
      
      expect(messages.inviteSent.subject).toBeTruthy();
      expect(messages.inviteSent.body).toContain('Kayak Tour');
      expect(messages.proposalCreated.subject).toBeTruthy();
    });
  });

  describe('Entry point specific copy', () => {
    it('lodging uses host/guest terminology', () => {
      const ctx: CopyContext = { entryPoint: 'lodging' };
      expect(resolveCopy('label.noun.provider', ctx)).toBe('host');
      expect(resolveCopy('label.noun.requester', ctx)).toBe('guest');
      expect(resolveCopy('ui.market.locked_notice', ctx)).toContain('Host');
    });

    it('marina uses marina/boater terminology', () => {
      const ctx: CopyContext = { entryPoint: 'marina' };
      expect(resolveCopy('label.noun.provider', ctx)).toBe('marina');
      expect(resolveCopy('label.noun.requester', ctx)).toBe('boater');
      expect(resolveCopy('label.noun.request', ctx)).toBe('moorage request');
    });

    it('service uses provider/client terminology', () => {
      const ctx: CopyContext = { entryPoint: 'service' };
      expect(resolveCopy('label.noun.provider', ctx)).toBe('service provider');
      expect(resolveCopy('label.noun.requester', ctx)).toBe('client');
    });
  });
});
