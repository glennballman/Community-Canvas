/**
 * STEP 11C Phase 2C-12: Export Signing Key Health API
 * Admin-only endpoint for checking signing key configuration status
 */

import { Router, Request, Response } from 'express';
import { TenantRequest } from '../middleware/tenantContext';
import { requireAuth, requireTenant, requireRole } from '../middleware/guards';

const router = Router();

interface KeyHealthResponse {
  ok: boolean;
  active_key_id: string | null;
  public_key_ids: string[];
  has_private_key_configured: boolean;
  active_key_has_public_key: boolean;
  warnings: string[];
}

function getPublicKeyIds(): string[] {
  const publicKeysJson = process.env.CC_EXPORT_SIGNING_PUBLIC_KEYS_JSON;
  if (!publicKeysJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(publicKeysJson);
    return Object.keys(parsed);
  } catch {
    return [];
  }
}

router.get(
  '/export-signing-key-health',
  requireAuth,
  requireTenant,
  requireRole('tenant_owner', 'tenant_admin'),
  async (req: Request, res: Response) => {
    try {
      const activeKeyId = process.env.CC_EXPORT_SIGNING_KEY_ID || null;
      const publicKeyIds = getPublicKeyIds();
      const hasPrivateKeyConfigured = !!process.env.CC_EXPORT_SIGNING_PRIVATE_KEY_PEM;
      const activeKeyHasPublicKey = activeKeyId ? publicKeyIds.includes(activeKeyId) : false;

      const warnings: string[] = [];

      if (!activeKeyId) {
        warnings.push('Active signing key id is not set.');
      }
      if (publicKeyIds.length === 0) {
        warnings.push('No public keys are configured for verification.');
      }
      if (activeKeyId && !activeKeyHasPublicKey) {
        warnings.push('Active signing key id is not present in public keys (verification may fail).');
      }
      if (!hasPrivateKeyConfigured) {
        warnings.push('Private signing key is not configured (exports cannot be attested).');
      }

      const response: KeyHealthResponse = {
        ok: true,
        active_key_id: activeKeyId,
        public_key_ids: publicKeyIds,
        has_private_key_configured: hasPrivateKeyConfigured,
        active_key_has_public_key: activeKeyHasPublicKey,
        warnings,
      };

      return res.json(response);
    } catch (error) {
      console.error('Failed to get key health:', error);
      return res.status(500).json({ ok: false, error: 'Failed to get key health' });
    }
  }
);

export default router;
