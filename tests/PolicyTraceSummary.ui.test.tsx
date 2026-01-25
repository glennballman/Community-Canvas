import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PolicyTraceSummary } from '../client/src/components/PolicyTraceSummary';
import { TooltipProvider } from '../client/src/components/ui/tooltip';

vi.mock('@/copy/useCopy', () => ({
  useCopy: () => ({
    resolve: (key: string) => key,
  }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, {
  clipboard: mockClipboard,
});

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <TooltipProvider>
      {component}
    </TooltipProvider>
  );
};

function assertInDocument(element: HTMLElement | null): asserts element is HTMLElement {
  expect(element).not.toBeNull();
  expect(document.body.contains(element)).toBe(true);
}

function assertNotInDocument(element: HTMLElement | null): void {
  if (element === null) return;
  expect(document.body.contains(element)).toBe(false);
}

describe('PolicyTraceSummary Component (Phase 2C-9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClipboard.writeText.mockResolvedValue(undefined);
  });

  const validTrace = {
    negotiation_type: 'schedule',
    effective_source: 'platform' as const,
    platform_policy_id: '12345678-1234-1234-1234-123456789012',
    tenant_policy_id: null,
    effective_policy_id: 'abcdefab-abcd-abcd-abcd-abcdefabcdef',
    effective_policy_updated_at: '2026-01-25T10:00:00Z',
    effective_policy_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  };

  describe('Rendering', () => {
    it('renders nothing when trace is null', () => {
      const { container } = renderWithProviders(<PolicyTraceSummary trace={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when trace is undefined', () => {
      const { container } = renderWithProviders(<PolicyTraceSummary trace={undefined} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders compact view with correct data-testid', () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} compact />);
      assertInDocument(screen.getByTestId('policy-trace-summary-compact'));
    });

    it('renders full view with correct data-testid', () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      assertInDocument(screen.getByTestId('policy-trace-summary'));
    });
  });

  describe('Masking', () => {
    it('masks policy hash in display (shows partial)', () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      const hashElement = screen.getByTestId('text-policy-hash');
      const displayedHash = hashElement.textContent;
      expect(displayedHash).not.toBe(validTrace.effective_policy_hash);
      expect(displayedHash).toMatch(/^[a-f0-9]{8}…[a-f0-9]{4}$/);
    });

    it('does not show raw UUID in default view', () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      assertNotInDocument(screen.queryByText(validTrace.effective_policy_id));
      assertNotInDocument(screen.queryByText(validTrace.platform_policy_id!));
    });
  });

  describe('Effective Source Badge', () => {
    it('shows Platform badge for platform source', () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      const badge = screen.getByTestId('badge-effective-source');
      expect(badge.textContent).toBe('Platform');
    });

    it('shows Tenant Override badge for tenant_override source', () => {
      const tenantTrace = { ...validTrace, effective_source: 'tenant_override' as const };
      renderWithProviders(<PolicyTraceSummary trace={tenantTrace} />);
      const badge = screen.getByTestId('badge-effective-source');
      expect(badge.textContent).toBe('Tenant Override');
    });
  });

  describe('ID Disclosure', () => {
    it('shows toggle button for IDs', () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      assertInDocument(screen.getByTestId('button-toggle-ids'));
    });

    it('hides IDs by default', () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      expect(screen.queryByTestId('text-effective-policy-id')).toBeNull();
    });

    it('shows IDs after toggle', async () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      const toggleButton = screen.getByTestId('button-toggle-ids');
      fireEvent.click(toggleButton);
      assertInDocument(screen.getByTestId('text-effective-policy-id'));
    });

    it('shows masked effective policy ID when expanded', async () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      fireEvent.click(screen.getByTestId('button-toggle-ids'));
      const idElement = screen.getByTestId('text-effective-policy-id');
      expect(idElement.textContent).not.toBe(validTrace.effective_policy_id);
      expect(idElement.textContent).toMatch(/^[a-f0-9]{8}…$/);
    });
  });

  describe('Copy Functionality', () => {
    it('copy hash button exists', () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      assertInDocument(screen.getByTestId('button-copy-hash'));
    });

    it('copies full hash value on click', async () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      const copyButton = screen.getByTestId('button-copy-hash');
      fireEvent.click(copyButton);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(validTrace.effective_policy_hash);
    });

    it('copies full policy ID on click', async () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      fireEvent.click(screen.getByTestId('button-toggle-ids'));
      const copyButton = screen.getByTestId('button-copy-effective-policy-id');
      fireEvent.click(copyButton);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(validTrace.effective_policy_id);
    });
  });

  describe('Compact Mode', () => {
    it('shows hash with copy in compact mode', () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} compact />);
      assertInDocument(screen.getByTestId('button-copy-hash-compact'));
    });

    it('copies hash in compact mode', async () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} compact />);
      const copyButton = screen.getByTestId('button-copy-hash-compact');
      fireEvent.click(copyButton);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(validTrace.effective_policy_hash);
    });
  });

  describe('Relative Time Display', () => {
    it('shows relative time for updated_at', () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} />);
      const timeElement = screen.getByTestId('text-updated-at');
      expect(timeElement.textContent).toBeDefined();
      expect(timeElement.textContent).not.toBe(validTrace.effective_policy_updated_at);
    });
  });

  describe('Custom Title', () => {
    it('accepts custom title prop', () => {
      renderWithProviders(<PolicyTraceSummary trace={validTrace} title="Custom Title" />);
      assertInDocument(screen.getByText('Custom Title'));
    });
  });
});
