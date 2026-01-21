/**
 * A2.4: Address Normalization Service
 * 
 * Normalizes addresses for consistent matching and hashing.
 * Handles common variations in address formatting.
 */

import { createHash } from 'crypto';

/**
 * Street type abbreviations to normalize
 */
const STREET_TYPES: Record<string, string> = {
  'street': 'st',
  'avenue': 'ave',
  'road': 'rd',
  'drive': 'dr',
  'lane': 'ln',
  'boulevard': 'blvd',
  'court': 'ct',
  'place': 'pl',
  'circle': 'cir',
  'highway': 'hwy',
  'crescent': 'cres',
  'terrace': 'ter',
  'way': 'way',
  'trail': 'trl',
  'parkway': 'pkwy',
};

/**
 * Direction abbreviations to normalize
 */
const DIRECTIONS: Record<string, string> = {
  'north': 'n',
  'south': 's',
  'east': 'e',
  'west': 'w',
  'northeast': 'ne',
  'northwest': 'nw',
  'southeast': 'se',
  'southwest': 'sw',
};

/**
 * Unit type abbreviations
 */
const UNIT_TYPES: Record<string, string> = {
  'apartment': 'apt',
  'suite': 'ste',
  'unit': 'unit',
  'floor': 'fl',
  'room': 'rm',
  'building': 'bldg',
};

/**
 * Normalize an address string for consistent matching
 * 
 * Transformations:
 * - Lowercase everything
 * - Remove punctuation except hyphens in numbers
 * - Normalize street types (Street -> st)
 * - Normalize directions (North -> n)
 * - Normalize unit types (Apartment -> apt)
 * - Remove extra whitespace
 * - Remove common suffixes like country names
 */
export function normalizeAddressForHash(address: string): string {
  if (!address) return '';
  
  let normalized = address.toLowerCase();
  
  // Remove common suffixes (country, province/state abbreviations at end)
  normalized = normalized.replace(/,?\s*(canada|usa|us|ca|bc|british columbia|ab|alberta|on|ontario)$/i, '');
  
  // Remove punctuation except hyphens between numbers
  normalized = normalized.replace(/[.,#]/g, ' ');
  
  // Preserve hyphens in street numbers (123-456) but remove others
  normalized = normalized.replace(/(\d)-(\d)/g, '$1HYPHEN$2');
  normalized = normalized.replace(/-/g, ' ');
  normalized = normalized.replace(/HYPHEN/g, '-');
  
  // Split into words for normalization
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  
  // Normalize each word
  const normalizedWords = words.map(word => {
    // Check street types
    if (STREET_TYPES[word]) {
      return STREET_TYPES[word];
    }
    // Check directions
    if (DIRECTIONS[word]) {
      return DIRECTIONS[word];
    }
    // Check unit types
    if (UNIT_TYPES[word]) {
      return UNIT_TYPES[word];
    }
    return word;
  });
  
  // Join and clean up whitespace
  return normalizedWords.join(' ').trim();
}

/**
 * Generate SHA-256 hash of normalized address
 */
export function hashNormalizedAddress(normalizedAddress: string): string {
  return createHash('sha256').update(normalizedAddress).digest('hex');
}

/**
 * Combined: normalize and hash an address
 */
export function normalizeAndHashAddress(address: string): { 
  normalized: string; 
  hash: string; 
} {
  const normalized = normalizeAddressForHash(address);
  const hash = hashNormalizedAddress(normalized);
  return { normalized, hash };
}

/**
 * Extract potential postal code from address
 */
export function extractPostalCode(address: string): string | null {
  // Canadian postal code pattern: A1A 1A1 or A1A1A1
  const canadianMatch = address.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/i);
  if (canadianMatch) {
    return canadianMatch[0].toUpperCase().replace(/\s/g, ' ');
  }
  
  // US ZIP code pattern: 12345 or 12345-6789
  const usMatch = address.match(/\b\d{5}(-\d{4})?\b/);
  if (usMatch) {
    return usMatch[0];
  }
  
  return null;
}

/**
 * Extract house number from address start
 */
export function extractHouseNumber(address: string): string | null {
  // Match house numbers at start: 123, 123-456, 123A, etc.
  const match = address.match(/^(\d+[A-Z]?(-\d+[A-Z]?)?)/i);
  return match ? match[1] : null;
}
