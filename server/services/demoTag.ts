/**
 * Demo Tag Service - N3-CAL-04
 * Provides batch tagging for removable demo data.
 * DEV-only: All seeded rows are tracked for cleanup.
 */

export const DEMO_BATCH_ID = process.env.CC_DEMO_BATCH_ID || 'demo-2026-01-22';

export function demoTag() {
  return { demoBatchId: DEMO_BATCH_ID };
}

export function isDemoMode(): boolean {
  return process.env.NODE_ENV === 'development' || 
         process.env.CC_DEV_SEED === 'true' ||
         process.env.CC_DEMO_SEED === 'true';
}

export function validateDemoKey(headerKey: string | undefined): boolean {
  const envKey = process.env.CC_DEMO_SEED_KEY;
  if (!envKey) return true;
  return headerKey === envKey;
}
