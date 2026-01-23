import { describe, it, expect } from 'vitest';
import {
  gateActionsForViewer,
  hasAnyActions,
  isViewerRequester,
  isViewerProvider,
  type GateActionsInput,
} from '../../client/src/policy/publicActionGate';
import type { MarketAction } from '../../client/src/policy/marketModePolicy';

const makeAction = (id: string, tokenKey: string, kind: 'primary' | 'secondary' | 'danger' | 'link' = 'primary'): MarketAction => ({
  id,
  tokenKey,
  kind,
});

const SAMPLE_REQUESTER_ACTIONS: MarketAction[] = [
  makeAction('open_to_responses', 'cta.publish'),
  makeAction('invite_another_provider', 'cta.request.send'),
  makeAction('review_proposal', 'cta.proposal.accept'),
  makeAction('cancel_request', 'cta.request.cancel', 'danger'),
];

const SAMPLE_PROVIDER_ACTIONS: MarketAction[] = [
  makeAction('accept_request', 'cta.request.accept'),
  makeAction('decline_request', 'cta.request.decline', 'danger'),
  makeAction('propose_change', 'cta.proposal.propose_change', 'secondary'),
];

const SAMPLE_OPERATOR_ACTIONS: MarketAction[] = [
  makeAction('admin_reassign', 'cta.admin.reassign'),
  makeAction('admin_cancel', 'cta.admin.cancel', 'danger'),
  makeAction('close_signups', 'cta.run.close_signups'),
];

const ALL_ACTIONS = [...SAMPLE_REQUESTER_ACTIONS, ...SAMPLE_PROVIDER_ACTIONS, ...SAMPLE_OPERATOR_ACTIONS];

describe('publicActionGate', () => {
  describe('gateActionsForViewer', () => {
    describe('unauthenticated viewer', () => {
      it('returns no actions when not authenticated', () => {
        const result = gateActionsForViewer({
          isAuthenticated: false,
          viewerTenantId: 'tenant-123',
          requesterTenantId: 'tenant-123',
          actions: ALL_ACTIONS,
        });
        expect(result).toEqual([]);
      });

      it('returns no actions even if viewer matches requester', () => {
        const result = gateActionsForViewer({
          isAuthenticated: false,
          viewerTenantId: 'tenant-123',
          requesterTenantId: 'tenant-123',
          providerTenantId: 'tenant-456',
          actions: ALL_ACTIONS,
        });
        expect(result).toEqual([]);
      });
    });

    describe('authenticated non-owner', () => {
      it('returns no actions when viewer is neither requester nor provider', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-999',
          requesterTenantId: 'tenant-123',
          providerTenantId: 'tenant-456',
          actions: ALL_ACTIONS,
        });
        expect(result).toEqual([]);
      });

      it('returns no actions when viewerTenantId is undefined', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: undefined,
          requesterTenantId: 'tenant-123',
          providerTenantId: 'tenant-456',
          actions: ALL_ACTIONS,
        });
        expect(result).toEqual([]);
      });

      it('returns no actions when ownership cannot be determined', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-123',
          requesterTenantId: undefined,
          providerTenantId: undefined,
          actions: ALL_ACTIONS,
        });
        expect(result).toEqual([]);
      });
    });

    describe('authenticated requester', () => {
      it('returns only requester actions when viewer is requester', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-123',
          requesterTenantId: 'tenant-123',
          providerTenantId: 'tenant-456',
          actions: ALL_ACTIONS,
        });
        
        expect(result.map(a => a.id)).toEqual([
          'open_to_responses',
          'invite_another_provider',
          'review_proposal',
          'cancel_request',
        ]);
      });

      it('does not include operator actions for requester', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-123',
          requesterTenantId: 'tenant-123',
          providerTenantId: 'tenant-456',
          actions: ALL_ACTIONS,
        });
        
        expect(result.some(a => a.id.startsWith('admin_'))).toBe(false);
        expect(result.some(a => a.id === 'close_signups')).toBe(false);
      });

      it('does not include provider actions for requester', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-123',
          requesterTenantId: 'tenant-123',
          providerTenantId: 'tenant-456',
          actions: ALL_ACTIONS,
        });
        
        expect(result.some(a => a.id === 'accept_request')).toBe(false);
        expect(result.some(a => a.id === 'decline_request')).toBe(false);
        expect(result.some(a => a.id === 'propose_change')).toBe(false);
      });
    });

    describe('authenticated provider', () => {
      it('returns only provider actions when viewer is provider', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-456',
          requesterTenantId: 'tenant-123',
          providerTenantId: 'tenant-456',
          actions: ALL_ACTIONS,
        });
        
        expect(result.map(a => a.id)).toEqual([
          'accept_request',
          'decline_request',
          'propose_change',
        ]);
      });

      it('does not include operator actions for provider', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-456',
          requesterTenantId: 'tenant-123',
          providerTenantId: 'tenant-456',
          actions: ALL_ACTIONS,
        });
        
        expect(result.some(a => a.id.startsWith('admin_'))).toBe(false);
        expect(result.some(a => a.id === 'close_signups')).toBe(false);
      });

      it('does not include requester actions for provider', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-456',
          requesterTenantId: 'tenant-123',
          providerTenantId: 'tenant-456',
          actions: ALL_ACTIONS,
        });
        
        expect(result.some(a => a.id === 'open_to_responses')).toBe(false);
        expect(result.some(a => a.id === 'invite_another_provider')).toBe(false);
        expect(result.some(a => a.id === 'cancel_request')).toBe(false);
      });
    });

    describe('operator actions in public portal', () => {
      it('never allows operator actions even if viewer is authenticated', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-123',
          requesterTenantId: 'tenant-123',
          providerTenantId: 'tenant-456',
          actions: SAMPLE_OPERATOR_ACTIONS,
        });
        
        expect(result).toEqual([]);
      });

      it('never allows admin_reassign in public portal', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-123',
          requesterTenantId: 'tenant-123',
          actions: [makeAction('admin_reassign', 'cta.admin.reassign')],
        });
        
        expect(result).toEqual([]);
      });

      it('never allows admin_cancel in public portal', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-123',
          requesterTenantId: 'tenant-123',
          actions: [makeAction('admin_cancel', 'cta.admin.cancel')],
        });
        
        expect(result).toEqual([]);
      });

      it('never allows close_signups in public portal', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-123',
          requesterTenantId: 'tenant-123',
          actions: [makeAction('close_signups', 'cta.run.close_signups')],
        });
        
        expect(result).toEqual([]);
      });
    });

    describe('empty actions', () => {
      it('returns empty array when no actions provided', () => {
        const result = gateActionsForViewer({
          isAuthenticated: true,
          viewerTenantId: 'tenant-123',
          requesterTenantId: 'tenant-123',
          actions: [],
        });
        
        expect(result).toEqual([]);
      });
    });
  });

  describe('hasAnyActions', () => {
    it('returns true when authenticated requester has actions', () => {
      const result = hasAnyActions({
        isAuthenticated: true,
        viewerTenantId: 'tenant-123',
        requesterTenantId: 'tenant-123',
        actions: SAMPLE_REQUESTER_ACTIONS,
      });
      expect(result).toBe(true);
    });

    it('returns false when unauthenticated', () => {
      const result = hasAnyActions({
        isAuthenticated: false,
        viewerTenantId: 'tenant-123',
        requesterTenantId: 'tenant-123',
        actions: SAMPLE_REQUESTER_ACTIONS,
      });
      expect(result).toBe(false);
    });

    it('returns false when non-owner', () => {
      const result = hasAnyActions({
        isAuthenticated: true,
        viewerTenantId: 'tenant-999',
        requesterTenantId: 'tenant-123',
        providerTenantId: 'tenant-456',
        actions: SAMPLE_REQUESTER_ACTIONS,
      });
      expect(result).toBe(false);
    });
  });

  describe('isViewerRequester', () => {
    it('returns true when tenants match', () => {
      expect(isViewerRequester('tenant-123', 'tenant-123')).toBe(true);
    });

    it('returns false when tenants differ', () => {
      expect(isViewerRequester('tenant-123', 'tenant-456')).toBe(false);
    });

    it('returns false when viewerTenantId is undefined', () => {
      expect(isViewerRequester(undefined, 'tenant-123')).toBe(false);
    });

    it('returns false when requesterTenantId is undefined', () => {
      expect(isViewerRequester('tenant-123', undefined)).toBe(false);
    });
  });

  describe('isViewerProvider', () => {
    it('returns true when tenants match', () => {
      expect(isViewerProvider('tenant-456', 'tenant-456')).toBe(true);
    });

    it('returns false when tenants differ', () => {
      expect(isViewerProvider('tenant-123', 'tenant-456')).toBe(false);
    });

    it('returns false when viewerTenantId is undefined', () => {
      expect(isViewerProvider(undefined, 'tenant-456')).toBe(false);
    });

    it('returns false when providerTenantId is undefined', () => {
      expect(isViewerProvider('tenant-456', undefined)).toBe(false);
    });
  });
});
