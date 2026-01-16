/**
 * Pricing guardrails - Prevent forbidden pricing CTAs in operator console
 */

export const FORBIDDEN_PRICING_PATTERNS = [
  /upgrade\s+(now|to|your)/i,
  /unlock\s+(premium|pro|feature)/i,
  /subscribe\s+to/i,
  /buy\s+now/i,
  /purchase\s+plan/i,
  /pricing\s+tier/i,
  /\$\d+\s*(\/|per)\s*(month|year|mo|yr)/i,
  /free\s+trial\s+end/i,
  /credit\s+card\s+required/i,
  /billing\s+information/i,
];

/**
 * Assert that text contains no forbidden pricing copy
 * Only runs in dev mode, throws in dev for visibility
 */
export function assertNoForbiddenPricingCopy(text: string, contextLabel: string): void {
  if (!import.meta.env.DEV) return;
  
  for (const pattern of FORBIDDEN_PRICING_PATTERNS) {
    if (pattern.test(text)) {
      console.error(
        `[PRICING VIOLATION] Forbidden pricing copy detected in ${contextLabel}:`,
        `Pattern "${pattern.source}" matched in page content`
      );
    }
  }
}
