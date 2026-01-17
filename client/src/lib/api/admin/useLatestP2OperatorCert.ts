/**
 * useLatestP2OperatorCert - Fetch latest P2 operator certification
 * 
 * GET /api/admin/scm/latest-p2-operator-cert
 */

import { useQuery } from '@tanstack/react-query';
import { getAuthHeaders } from '../../api';

export interface CertCheck {
  name: string;
  status: 'PASS' | 'HELD' | 'FAIL';
  detail?: string;
}

export interface CertModule {
  status: 'PASS' | 'HELD' | 'FAIL';
  required: boolean;
  checks: CertCheck[];
}

export interface P2OperatorCert {
  cert_version: string;
  generated_at: string;
  input: {
    proof_path: string;
    proof_sha256: string;
    base_url: string;
    started_at: string;
    finished_at: string;
  };
  summary: {
    overall_status: 'PASS' | 'HELD' | 'FAIL';
    pass_modules: number;
    held_modules: number;
    fail_modules: number;
  };
  modules: {
    emergency: CertModule;
    authority: CertModule;
    legal: CertModule;
    insurance: CertModule;
    dispute: CertModule;
    monetization: CertModule;
    audit: CertModule;
  };
  evidence: {
    ids: Record<string, string>;
    steps: Array<{ step: string; ok: boolean | string; [k: string]: unknown }>;
    assertions: Array<{ assert: string; pass: boolean }>;
    monetization_snapshot: unknown;
    audit_snapshot: unknown;
  };
}

interface CertResponse {
  ok: boolean;
  cert?: P2OperatorCert;
  error?: string;
}

export function useLatestP2OperatorCert() {
  return useQuery({
    queryKey: ['admin', 'scm', 'latest-p2-operator-cert'],
    queryFn: async (): Promise<P2OperatorCert | null> => {
      const res = await fetch('/api/admin/scm/latest-p2-operator-cert', {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      
      if (!res.ok) {
        return null;
      }
      
      const data: CertResponse = await res.json();
      
      if (!data.ok || !data.cert) {
        return null;
      }
      
      return data.cert;
    },
    staleTime: 60_000,
    retry: false,
  });
}
