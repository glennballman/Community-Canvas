import crypto from 'crypto';

let _pepper: string | null = null;
let _initialized = false;

export function initImpersonationPepper(): void {
  const pepper = process.env.IMPERSONATION_PEPPER;
  
  if (!pepper || pepper.length < 32) {
    console.error('[SECURITY] IMPERSONATION_PEPPER env var missing or too short (min 32 chars)');
    _pepper = null;
  } else {
    _pepper = pepper;
    console.log('[impersonationPepper] Pepper initialized successfully');
  }
  
  _initialized = true;
}

export function isPepperAvailable(): boolean {
  if (!_initialized) {
    initImpersonationPepper();
  }
  return _pepper !== null;
}

export function hashImpersonationToken(token: string): string | null {
  if (!_initialized) {
    initImpersonationPepper();
  }
  
  if (!_pepper) {
    return null;
  }
  
  return crypto.createHash('sha256').update(token + _pepper).digest('hex');
}

export function getPepperStatus(): { available: boolean; initialized: boolean } {
  return { available: _pepper !== null, initialized: _initialized };
}
