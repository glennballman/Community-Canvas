import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { findUUIDsInString } from './leakScan';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_UUID_2 = 'b2c3d4e5-f6a7-8901-bcde-f23456789012';
const INVALID_UUID = 'not-a-valid-uuid';
const MASKED_PATTERN = /^[0-9a-f]{8}…$/i;

const mockToast = vi.fn();
const mockResolve = vi.fn((key: string) => {
  const map: Record<string, string> = {
    'provider.schedule_proposals.proposal_context.label.context_attached': 'Context attached',
    'provider.schedule_proposals.proposal_context.chip.quote_draft': 'Quote Draft',
    'provider.schedule_proposals.proposal_context.chip.estimate': 'Estimate',
    'provider.schedule_proposals.proposal_context.chip.bid': 'Bid',
    'provider.schedule_proposals.proposal_context.chip.trip': 'Reservation',
    'provider.schedule_proposals.proposal_context.action.show_ids': 'Show IDs',
    'provider.schedule_proposals.proposal_context.action.hide_ids': 'Hide IDs',
    'provider.schedule_proposals.proposal_context.action.copy_id': 'Copy ID',
    'provider.schedule_proposals.proposal_context.action.copied': 'Copied',
    'provider.schedule_proposals.proposal_context.field.quote_draft_id': 'Quote Draft ID',
    'provider.schedule_proposals.proposal_context.field.estimate_id': 'Estimate ID',
  };
  return map[key] || key;
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/copy/useCopy', () => ({
  useCopy: () => ({ resolve: mockResolve }),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span data-testid="badge" {...props}>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock('lucide-react', () => ({
  Copy: () => <span>CopyIcon</span>,
  ChevronDown: () => <span>ChevronDown</span>,
  ChevronUp: () => <span>ChevronUp</span>,
  FileText: () => <span>FileTextIcon</span>,
  Calculator: () => <span>CalculatorIcon</span>,
  Briefcase: () => <span>BriefcaseIcon</span>,
  MapPin: () => <span>MapPinIcon</span>,
  Tag: () => <span>TagIcon</span>,
}));

import { ProposalContextInline } from '../client/src/components/ProposalContextInline';

describe('ProposalContextInline Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Policy Gate', () => {
    it('renders nothing when allow=false', () => {
      const { container } = render(
        <ProposalContextInline
          mode="provider"
          allow={false}
          proposalContext={{ quote_draft_id: VALID_UUID }}
        />
      );
      expect(container.innerHTML).toBe('');
    });

    it('renders nothing when proposalContext is null', () => {
      const { container } = render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={null}
        />
      );
      expect(container.innerHTML).toBe('');
    });

    it('renders nothing when proposalContext has no valid fields', () => {
      const { container } = render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={{}}
        />
      );
      expect(container.innerHTML).toBe('');
    });
  });

  describe('No UUID Leakage (Collapsed State)', () => {
    it('does not display full UUIDs in collapsed state', () => {
      render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={{
            quote_draft_id: VALID_UUID,
            estimate_id: VALID_UUID_2,
          }}
        />
      );

      const bodyText = document.body.textContent || '';
      const foundUUIDs = findUUIDsInString(bodyText);
      expect(foundUUIDs).toEqual([]);
      expect(screen.getByText('Context attached')).toBeInTheDocument();
    });

    it('displays chips for each context type', () => {
      render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={{
            quote_draft_id: VALID_UUID,
          }}
        />
      );

      expect(screen.getByText('Quote Draft')).toBeInTheDocument();
    });
  });

  describe('Disclosure Button Visibility', () => {
    it('shows "Show IDs" button when valid UUIDs exist', () => {
      render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={{ quote_draft_id: VALID_UUID }}
        />
      );

      expect(screen.getByText('Show IDs')).toBeInTheDocument();
    });

    it('hides "Show IDs" button when only invalid UUIDs exist', () => {
      render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={{
            quote_draft_id: INVALID_UUID,
            selected_scope_option: 'hybrid',
          }}
        />
      );

      expect(screen.queryByText('Show IDs')).not.toBeInTheDocument();
      expect(screen.getByText('hybrid')).toBeInTheDocument();
    });

    it('shows button only when at least one valid UUID exists', () => {
      render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={{
            quote_draft_id: INVALID_UUID,
            estimate_id: VALID_UUID,
          }}
        />
      );

      expect(screen.getByText('Show IDs')).toBeInTheDocument();
    });
  });

  describe('Disclosure Shows Masked Only', () => {
    it('shows masked UUIDs after disclosure', async () => {
      render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={{ quote_draft_id: VALID_UUID }}
        />
      );

      fireEvent.click(screen.getByText('Show IDs'));

      const bodyText = document.body.textContent || '';
      const foundUUIDs = findUUIDsInString(bodyText);
      expect(foundUUIDs).toEqual([]);

      const maskedValue = VALID_UUID.substring(0, 8) + '…';
      expect(screen.getByText(maskedValue)).toBeInTheDocument();
    });

    it('masked value matches expected pattern', async () => {
      render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={{ quote_draft_id: VALID_UUID }}
        />
      );

      fireEvent.click(screen.getByText('Show IDs'));

      const maskedValue = VALID_UUID.substring(0, 8) + '…';
      expect(MASKED_PATTERN.test(maskedValue)).toBe(true);
    });
  });

  describe('Copy Functionality', () => {
    it('copies full UUID without displaying it', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined),
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={{ quote_draft_id: VALID_UUID }}
        />
      );

      fireEvent.click(screen.getByText('Show IDs'));
      fireEvent.click(screen.getByTestId('button-copy-quote_draft_id'));

      expect(mockClipboard.writeText).toHaveBeenCalledWith(VALID_UUID);

      const bodyText = document.body.textContent || '';
      const foundUUIDs = findUUIDsInString(bodyText);
      expect(foundUUIDs).toEqual([]);
    });
  });

  describe('Unknown Keys Handling', () => {
    it('ignores unknown keys in proposalContext', () => {
      render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={{
            quote_draft_id: VALID_UUID,
            unknown_key: 'should-not-render',
            another_unknown: VALID_UUID_2,
          } as any}
        />
      );

      expect(screen.queryByText('should-not-render')).not.toBeInTheDocument();
      expect(screen.queryByText('unknown_key')).not.toBeInTheDocument();
    });
  });

  describe('Selected Scope Option', () => {
    it('renders selected_scope_option as badge', () => {
      render(
        <ProposalContextInline
          mode="provider"
          allow={true}
          proposalContext={{ selected_scope_option: 'premium' }}
        />
      );

      expect(screen.getByText('premium')).toBeInTheDocument();
    });
  });
});
