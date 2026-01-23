import { describe, it, expect } from 'vitest';
import {
  getMarketActions,
  hasAction,
  getAction,
  getPrimaryAction,
  getSecondaryActions,
  getDangerActions,
  type GetMarketActionsInput,
  type MarketAction,
} from '../marketModePolicy';

describe('marketModePolicy', () => {
  describe('ServiceRequest - Requester role', () => {
    it('DRAFT + PRIVATE: shows send_to_provider action', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'requester',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        requestStatus: 'DRAFT',
      });
      
      expect(hasAction(actions, 'send_to_provider')).toBe(true);
      const action = getAction(actions, 'send_to_provider');
      expect(action?.tokenKey).toBe('cta.request.send');
      expect(action?.kind).toBe('primary');
    });

    it('DRAFT + PORTAL: shows publish action', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'requester',
        marketMode: 'OPEN',
        visibility: 'PORTAL',
        requestStatus: 'DRAFT',
      });
      
      expect(hasAction(actions, 'publish')).toBe(true);
      const action = getAction(actions, 'publish');
      expect(action?.tokenKey).toBe('cta.publish');
    });

    it('AWAITING_RESPONSE: can cancel request', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'requester',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        requestStatus: 'AWAITING_RESPONSE',
      });
      
      expect(hasAction(actions, 'cancel_request')).toBe(true);
      const action = getAction(actions, 'cancel_request');
      expect(action?.kind).toBe('danger');
      expect(action?.requiresConfirm).toBe(true);
    });

    it('PROPOSED_CHANGE + hasActiveProposal: can accept/reject proposal', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'requester',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        requestStatus: 'PROPOSED_CHANGE',
        hasActiveProposal: true,
      });
      
      expect(hasAction(actions, 'accept_proposal')).toBe(true);
      expect(hasAction(actions, 'reject_proposal')).toBe(true);
      
      const accept = getAction(actions, 'accept_proposal');
      expect(accept?.tokenKey).toBe('cta.proposal.accept');
      expect(accept?.kind).toBe('primary');
      
      const reject = getAction(actions, 'reject_proposal');
      expect(reject?.tokenKey).toBe('cta.proposal.reject');
      expect(reject?.kind).toBe('secondary');
    });

    it('UNASSIGNED + TARGETED: shows invite_another_provider and modify actions', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'requester',
        marketMode: 'TARGETED',
        visibility: 'PORTAL',
        requestStatus: 'UNASSIGNED',
      });
      
      expect(hasAction(actions, 'invite_another_provider')).toBe(true);
      expect(hasAction(actions, 'modify_request')).toBe(true);
      expect(hasAction(actions, 'cancel_request')).toBe(true);
      
      const invite = getAction(actions, 'invite_another_provider');
      expect(invite?.tokenKey).toBe('cta.request.invite_another_provider');
      expect(invite?.kind).toBe('primary');
    });

    it('DECLINED + INVITE_ONLY: shows open_to_responses and invite_another_provider', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'requester',
        marketMode: 'INVITE_ONLY',
        visibility: 'PORTAL',
        requestStatus: 'DECLINED',
      });
      
      expect(hasAction(actions, 'open_to_responses')).toBe(true);
      expect(hasAction(actions, 'invite_another_provider')).toBe(true);
      
      const openToResponses = getAction(actions, 'open_to_responses');
      expect(openToResponses?.tokenKey).toBe('cta.request.open_to_bids');
    });

    it('UNASSIGNED + OPEN: shows open_to_responses but NOT invite_another_provider', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'requester',
        marketMode: 'OPEN',
        visibility: 'PORTAL',
        requestStatus: 'UNASSIGNED',
      });
      
      expect(hasAction(actions, 'open_to_responses')).toBe(true);
      expect(hasAction(actions, 'invite_another_provider')).toBe(false);
    });

    it('ACCEPTED: no actions available (stable state)', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'requester',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        requestStatus: 'ACCEPTED',
      });
      
      expect(actions.length).toBe(0);
    });

    it('CANCELLED: no actions available', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'requester',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        requestStatus: 'CANCELLED',
      });
      
      expect(actions.length).toBe(0);
    });
  });

  describe('ServiceRequest - Provider role', () => {
    it('AWAITING_RESPONSE + TARGETED + hasTargetProvider: can accept/propose/decline', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'provider',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        requestStatus: 'AWAITING_RESPONSE',
        hasTargetProvider: true,
      });
      
      expect(hasAction(actions, 'accept_request')).toBe(true);
      expect(hasAction(actions, 'propose_change')).toBe(true);
      expect(hasAction(actions, 'decline_request')).toBe(true);
      
      const accept = getAction(actions, 'accept_request');
      expect(accept?.tokenKey).toBe('cta.request.accept');
      expect(accept?.kind).toBe('primary');
      
      const propose = getAction(actions, 'propose_change');
      expect(propose?.tokenKey).toBe('cta.proposal.propose_change');
      expect(propose?.kind).toBe('secondary');
      
      const decline = getAction(actions, 'decline_request');
      expect(decline?.kind).toBe('danger');
      expect(decline?.requiresConfirm).toBe(true);
    });

    it('AWAITING_RESPONSE + OPEN: can submit response', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'provider',
        marketMode: 'OPEN',
        visibility: 'PORTAL',
        requestStatus: 'AWAITING_RESPONSE',
      });
      
      expect(hasAction(actions, 'submit_response')).toBe(true);
      
      const submit = getAction(actions, 'submit_response');
      expect(submit?.tokenKey).toBe('cta.proposal.submit');
      expect(submit?.kind).toBe('primary');
    });

    it('ACCEPTED: can withdraw acceptance', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'provider',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        requestStatus: 'ACCEPTED',
      });
      
      expect(hasAction(actions, 'withdraw_acceptance')).toBe(true);
      
      const withdraw = getAction(actions, 'withdraw_acceptance');
      expect(withdraw?.kind).toBe('danger');
      expect(withdraw?.requiresConfirm).toBe(true);
    });

    it('DRAFT: no actions for provider', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'provider',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        requestStatus: 'DRAFT',
      });
      
      expect(actions.length).toBe(0);
    });
  });

  describe('ServiceRequest - Operator role', () => {
    it('non-terminal states: shows admin actions', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'operator',
        marketMode: 'TARGETED',
        visibility: 'PORTAL',
        requestStatus: 'AWAITING_RESPONSE',
      });
      
      expect(hasAction(actions, 'admin_reassign')).toBe(true);
      expect(hasAction(actions, 'admin_cancel')).toBe(true);
      
      const reassign = getAction(actions, 'admin_reassign');
      expect(reassign?.tokenKey).toBe('cta.admin.reassign');
      
      const cancel = getAction(actions, 'admin_cancel');
      expect(cancel?.kind).toBe('danger');
      expect(cancel?.requiresConfirm).toBe(true);
    });

    it('CANCELLED: no admin actions', () => {
      const actions = getMarketActions({
        objectType: 'service_request',
        actorRole: 'operator',
        marketMode: 'TARGETED',
        visibility: 'PORTAL',
        requestStatus: 'CANCELLED',
      });
      
      expect(actions.length).toBe(0);
    });
  });

  describe('ServiceRun - Requester role', () => {
    it('collecting + not published + PORTAL: can publish', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'requester',
        marketMode: 'OPEN',
        visibility: 'PORTAL',
        runStatus: 'collecting',
        isPublished: false,
      });
      
      expect(hasAction(actions, 'publish')).toBe(true);
      
      const publish = getAction(actions, 'publish');
      expect(publish?.tokenKey).toBe('cta.publish');
      expect(publish?.kind).toBe('primary');
    });

    it('collecting + PRIVATE: cannot publish', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'requester',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        runStatus: 'collecting',
        isPublished: false,
      });
      
      expect(hasAction(actions, 'publish')).toBe(false);
    });

    it('collecting + published: can close signups', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'requester',
        marketMode: 'OPEN',
        visibility: 'PORTAL',
        runStatus: 'collecting',
        isPublished: true,
      });
      
      expect(hasAction(actions, 'close_signups')).toBe(true);
      
      const closeSignups = getAction(actions, 'close_signups');
      expect(closeSignups?.tokenKey).toBe('cta.run.close_signups');
    });
  });

  describe('ServiceRun - Provider role', () => {
    it('collecting + OPEN: can express interest', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'provider',
        marketMode: 'OPEN',
        visibility: 'PORTAL',
        runStatus: 'collecting',
      });
      
      expect(hasAction(actions, 'express_interest')).toBe(true);
      
      const interest = getAction(actions, 'express_interest');
      expect(interest?.tokenKey).toBe('cta.run.express_interest');
      expect(interest?.kind).toBe('primary');
    });

    it('bidding: can submit response', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'provider',
        marketMode: 'OPEN',
        visibility: 'PORTAL',
        runStatus: 'bidding',
      });
      
      expect(hasAction(actions, 'submit_response')).toBe(true);
      
      const submit = getAction(actions, 'submit_response');
      expect(submit?.tokenKey).toBe('cta.proposal.submit');
    });

    it('confirmed: can withdraw', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'provider',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        runStatus: 'confirmed',
      });
      
      expect(hasAction(actions, 'withdraw_run')).toBe(true);
      
      const withdraw = getAction(actions, 'withdraw_run');
      expect(withdraw?.tokenKey).toBe('cta.run.withdraw');
      expect(withdraw?.kind).toBe('danger');
      expect(withdraw?.requiresConfirm).toBe(true);
    });

    it('scheduled: can withdraw', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'provider',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        runStatus: 'scheduled',
      });
      
      expect(hasAction(actions, 'withdraw_run')).toBe(true);
    });

    it('in_progress: can mark complete', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'provider',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        runStatus: 'in_progress',
      });
      
      expect(hasAction(actions, 'mark_complete')).toBe(true);
      
      const markComplete = getAction(actions, 'mark_complete');
      expect(markComplete?.tokenKey).toBe('cta.run.mark_complete');
      expect(markComplete?.kind).toBe('primary');
    });

    it('completed: no actions', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'provider',
        marketMode: 'TARGETED',
        visibility: 'PRIVATE',
        runStatus: 'completed',
      });
      
      expect(actions.length).toBe(0);
    });
  });

  describe('ServiceRun - Operator role', () => {
    it('non-terminal states: shows admin actions', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'operator',
        marketMode: 'OPEN',
        visibility: 'PORTAL',
        runStatus: 'bidding',
      });
      
      expect(hasAction(actions, 'admin_force_status')).toBe(true);
      expect(hasAction(actions, 'admin_cancel')).toBe(true);
      
      const forceStatus = getAction(actions, 'admin_force_status');
      expect(forceStatus?.tokenKey).toBe('cta.admin.force_status');
    });

    it('completed: no admin actions', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'operator',
        marketMode: 'OPEN',
        visibility: 'PORTAL',
        runStatus: 'completed',
      });
      
      expect(actions.length).toBe(0);
    });

    it('cancelled: no admin actions', () => {
      const actions = getMarketActions({
        objectType: 'service_run',
        actorRole: 'operator',
        marketMode: 'OPEN',
        visibility: 'PORTAL',
        runStatus: 'cancelled',
      });
      
      expect(actions.length).toBe(0);
    });
  });

  describe('Helper functions', () => {
    it('hasAction returns true for existing actions', () => {
      const actions: MarketAction[] = [
        { id: 'test', tokenKey: 'test.key', kind: 'primary' },
      ];
      
      expect(hasAction(actions, 'test')).toBe(true);
      expect(hasAction(actions, 'nonexistent')).toBe(false);
    });

    it('getPrimaryAction returns first primary action', () => {
      const actions: MarketAction[] = [
        { id: 'secondary1', tokenKey: 'test.key', kind: 'secondary' },
        { id: 'primary1', tokenKey: 'test.key', kind: 'primary' },
        { id: 'primary2', tokenKey: 'test.key', kind: 'primary' },
      ];
      
      const primary = getPrimaryAction(actions);
      expect(primary?.id).toBe('primary1');
    });

    it('getSecondaryActions returns all secondary actions', () => {
      const actions: MarketAction[] = [
        { id: 'primary1', tokenKey: 'test.key', kind: 'primary' },
        { id: 'secondary1', tokenKey: 'test.key', kind: 'secondary' },
        { id: 'secondary2', tokenKey: 'test.key', kind: 'secondary' },
        { id: 'danger1', tokenKey: 'test.key', kind: 'danger' },
      ];
      
      const secondary = getSecondaryActions(actions);
      expect(secondary.length).toBe(2);
      expect(secondary.map(a => a.id)).toEqual(['secondary1', 'secondary2']);
    });

    it('getDangerActions returns all danger actions', () => {
      const actions: MarketAction[] = [
        { id: 'primary1', tokenKey: 'test.key', kind: 'primary' },
        { id: 'danger1', tokenKey: 'test.key', kind: 'danger' },
        { id: 'danger2', tokenKey: 'test.key', kind: 'danger' },
      ];
      
      const danger = getDangerActions(actions);
      expect(danger.length).toBe(2);
    });
  });

  describe('Token key validation', () => {
    it('all actions use valid copy token keys', () => {
      const testCases: GetMarketActionsInput[] = [
        { objectType: 'service_request', actorRole: 'requester', marketMode: 'TARGETED', visibility: 'PRIVATE', requestStatus: 'DRAFT' },
        { objectType: 'service_request', actorRole: 'requester', marketMode: 'OPEN', visibility: 'PORTAL', requestStatus: 'UNASSIGNED' },
        { objectType: 'service_request', actorRole: 'provider', marketMode: 'TARGETED', visibility: 'PRIVATE', requestStatus: 'AWAITING_RESPONSE', hasTargetProvider: true },
        { objectType: 'service_request', actorRole: 'operator', marketMode: 'TARGETED', visibility: 'PORTAL', requestStatus: 'AWAITING_RESPONSE' },
        { objectType: 'service_run', actorRole: 'requester', marketMode: 'OPEN', visibility: 'PORTAL', runStatus: 'collecting', isPublished: false },
        { objectType: 'service_run', actorRole: 'provider', marketMode: 'OPEN', visibility: 'PORTAL', runStatus: 'bidding' },
        { objectType: 'service_run', actorRole: 'operator', marketMode: 'OPEN', visibility: 'PORTAL', runStatus: 'in_progress' },
      ];

      for (const input of testCases) {
        const actions = getMarketActions(input);
        for (const action of actions) {
          expect(action.tokenKey).toMatch(/^(cta|ui)\./);
          expect(action.tokenKey.length).toBeGreaterThan(5);
        }
      }
    });
  });
});
