import { customAlphabet } from 'nanoid';

const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const generateCode = customAlphabet(alphabet, 6);

export function generateTripAccessCode(portalSlug: string): string {
  const prefix = portalSlug.substring(0, 3).toUpperCase();
  const code = generateCode();
  return `${prefix}-${code}`;
}

export function generateTripAccessCodeWithRetry(
  portalSlug: string,
  existingCodes: Set<string>,
  maxRetries = 10
): string {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateTripAccessCode(portalSlug);
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  return `${generateTripAccessCode(portalSlug)}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}
