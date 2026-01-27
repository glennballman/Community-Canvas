/**
 * IMPERSONATION DEBUG LOGGER
 * 
 * Forensic logging for impersonation flow diagnosis.
 * DO NOT use for production. Remove after debugging.
 */

export function now(): string {
  return new Date().toISOString();
}

export function safePath(): string {
  return typeof window !== 'undefined' ? window.location.pathname : 'SSR';
}

export function shortUser(u: any): { id: string; email: string; isPlatformAdmin: boolean } | null {
  if (!u) return null;
  return {
    id: u.id?.slice?.(0, 8) || u.id,
    email: u.email,
    isPlatformAdmin: !!u.is_platform_admin,
  };
}

export function shortImp(i: any): { active: boolean; targetEmail: string | null; tenantId: string | null } | null {
  if (!i) return null;
  return {
    active: !!i.active,
    targetEmail: i.target_user?.email || null,
    tenantId: i.tenant_id?.slice?.(0, 8) || i.tenant_id || null,
  };
}

export function dbg(label: string, payload: Record<string, any>): void {
  if (typeof console !== 'undefined') {
    console.log(`[IMPERSONATION_DBG] ${now()} ${label}`, JSON.stringify(payload));
  }
}
