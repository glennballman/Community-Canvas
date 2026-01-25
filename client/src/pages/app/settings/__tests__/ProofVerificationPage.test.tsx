/**
 * Phase 2C-12: Proof Verification Page UI Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProofVerificationPage from '../ProofVerificationPage';

const mockKeyHealthResponse = {
  ok: true,
  active_key_id: 'test-k1',
  public_key_ids: ['test-k1', 'test-k2'],
  has_private_key_configured: true,
  active_key_has_public_key: true,
  warnings: [],
};

const mockVerifySuccessResponse = {
  ok: true,
  verified: true,
  key_id: 'test-k1',
  hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  signature_scope: 'hash',
  signed_at: '2026-01-25T12:00:00.000Z',
};

const mockVerifyFailureResponse = {
  ok: true,
  verified: false,
  reason: 'Hash mismatch: data may have been modified',
};

const mockInvalidJsonResponse = {
  ok: true,
  verified: false,
  reason: 'Invalid JSON',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Phase 2C-12: ProofVerificationPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('export-signing-key-health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockKeyHealthResponse),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockVerifySuccessResponse),
      });
    });

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders page title and description', async () => {
    render(<ProofVerificationPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('text-page-title')).toBeInTheDocument();
    });
  });

  it('renders KeyHealthPanel with mocked API response', async () => {
    render(<ProofVerificationPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('text-active-key-id')).toBeInTheDocument();
    });

    expect(screen.getByTestId('text-private-key-status')).toBeInTheDocument();
    expect(screen.getByTestId('text-public-keys')).toBeInTheDocument();
  });

  it('shows verify button and json input', async () => {
    render(<ProofVerificationPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('button-verify')).toBeInTheDocument();
    });

    expect(screen.getByTestId('input-json')).toBeInTheDocument();
    expect(screen.getByTestId('button-clear')).toBeInTheDocument();
  });

  it('paste JSON and click Verify shows verified state', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('export-signing-key-health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockKeyHealthResponse),
        });
      }
      if (url.includes('verify')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVerifySuccessResponse),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<ProofVerificationPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('input-json')).toBeInTheDocument();
    });

    const jsonInput = screen.getByTestId('input-json');
    fireEvent.change(jsonInput, { target: { value: '{"test": "data"}' } });

    const verifyButton = screen.getByTestId('button-verify');
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByTestId('card-verification-result')).toBeInTheDocument();
    });

    expect(screen.getByTestId('text-verification-status')).toHaveTextContent(/verified/i);
  });

  it('invalid JSON shows invalid_json error message', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('export-signing-key-health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockKeyHealthResponse),
        });
      }
      if (url.includes('verify')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockInvalidJsonResponse),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<ProofVerificationPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('input-json')).toBeInTheDocument();
    });

    const jsonInput = screen.getByTestId('input-json');
    fireEvent.change(jsonInput, { target: { value: 'not valid json' } });

    const verifyButton = screen.getByTestId('button-verify');
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByTestId('text-verification-reason')).toBeInTheDocument();
    });

    expect(screen.getByTestId('text-verification-reason')).toHaveTextContent(/not valid JSON/i);
  });

  it('not verified shows reason mapped message', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('export-signing-key-health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockKeyHealthResponse),
        });
      }
      if (url.includes('verify')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVerifyFailureResponse),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<ProofVerificationPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('input-json')).toBeInTheDocument();
    });

    const jsonInput = screen.getByTestId('input-json');
    fireEvent.change(jsonInput, { target: { value: '{"test": "tampered"}' } });

    const verifyButton = screen.getByTestId('button-verify');
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByTestId('text-verification-status')).toBeInTheDocument();
    });

    expect(screen.getByTestId('text-verification-status')).toHaveTextContent(/not verified/i);
    expect(screen.getByTestId('text-verification-reason')).toHaveTextContent(/modified/i);
  });

  it('hash displayed masked by default', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('export-signing-key-health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockKeyHealthResponse),
        });
      }
      if (url.includes('verify')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVerifySuccessResponse),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<ProofVerificationPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('input-json')).toBeInTheDocument();
    });

    const jsonInput = screen.getByTestId('input-json');
    fireEvent.change(jsonInput, { target: { value: '{"test": "data"}' } });

    const verifyButton = screen.getByTestId('button-verify');
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByTestId('text-export-hash')).toBeInTheDocument();
    });

    const hashElement = screen.getByTestId('text-export-hash');
    expect(hashElement.textContent).toContain('…');
    expect(hashElement.textContent).not.toBe(mockVerifySuccessResponse.hash);
  });

  it('copy calls clipboard with full hash', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('export-signing-key-health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockKeyHealthResponse),
        });
      }
      if (url.includes('verify')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockVerifySuccessResponse),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<ProofVerificationPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('input-json')).toBeInTheDocument();
    });

    const jsonInput = screen.getByTestId('input-json');
    fireEvent.change(jsonInput, { target: { value: '{"test": "data"}' } });

    const verifyButton = screen.getByTestId('button-verify');
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByTestId('button-copy-hash')).toBeInTheDocument();
    });

    const copyButton = screen.getByTestId('button-copy-hash');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockVerifySuccessResponse.hash);
    });
  });

  it('shows warnings from key health when present', async () => {
    const healthWithWarnings = {
      ...mockKeyHealthResponse,
      warnings: ['Private signing key is not configured (exports cannot be attested).'],
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('export-signing-key-health')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(healthWithWarnings),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<ProofVerificationPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('text-warning-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('text-warning-0')).toHaveTextContent(/private signing key/i);
  });
});
