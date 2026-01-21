/**
 * A2.4: Geocoding Service
 * 
 * Provides reverse and forward geocoding using Nominatim (OpenStreetMap).
 * Includes rate limiting and caching to be a good API citizen.
 */

import { normalizeAndHashAddress } from './normalizeAddress';

// ============================================================================
// TYPES
// ============================================================================

export interface AddressComponents {
  house_number?: string;
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  province?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

export interface GeoCandidate {
  formattedAddress: string;
  components: AddressComponents;
  lat: number | null;
  lng: number | null;
  provider: string;
  providerPlaceId: string | null;
  confidence: number;
  normalizedAddressHash: string;
}

// ============================================================================
// RATE LIMITING & CACHING
// ============================================================================

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_REQUEST_INTERVAL_MS = 1100; // Nominatim asks for max 1 req/sec

interface CacheEntry {
  data: GeoCandidate[];
  timestamp: number;
}

const geocodeCache = new Map<string, CacheEntry>();
let lastRequestTime = 0;

/**
 * Enforce rate limiting - wait if needed
 */
async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Get from cache if valid
 */
function getFromCache(key: string): GeoCandidate[] | null {
  const entry = geocodeCache.get(key);
  if (entry && (Date.now() - entry.timestamp) < CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

/**
 * Store in cache
 */
function storeInCache(key: string, data: GeoCandidate[]): void {
  geocodeCache.set(key, { data, timestamp: Date.now() });
  
  // Clean old entries (keep cache size reasonable)
  if (geocodeCache.size > 1000) {
    const now = Date.now();
    const keys = Array.from(geocodeCache.keys());
    for (const k of keys) {
      const v = geocodeCache.get(k);
      if (v && now - v.timestamp > CACHE_TTL_MS) {
        geocodeCache.delete(k);
      }
    }
  }
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

/**
 * Calculate confidence score (0-100) based on address components
 * 
 * Heuristic:
 * - base 50 if any address
 * - +15 house_number
 * - +10 road
 * - +10 locality/town/city
 * - +5 postal_code
 * - -20 if only region/county-level
 * 
 * Clamp to 0-100
 */
export function calculateConfidence(components: AddressComponents): number {
  let confidence = 50; // Base score for any result
  
  // Check for house number
  if (components.house_number) {
    confidence += 15;
  }
  
  // Check for road/street
  if (components.road) {
    confidence += 10;
  }
  
  // Check for locality
  if (components.city || components.town || components.village || components.municipality) {
    confidence += 10;
  }
  
  // Check for postal code
  if (components.postcode) {
    confidence += 5;
  }
  
  // Penalty if only region-level (no street, no house)
  if (!components.house_number && !components.road) {
    confidence -= 20;
  }
  
  // Clamp to 0-100
  return Math.max(0, Math.min(100, confidence));
}

// ============================================================================
// NOMINATIM API
// ============================================================================

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'CommunityCanvas/1.0 (https://community-canvas.app)';

interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    province?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
  boundingbox: string[];
}

/**
 * Parse Nominatim result into GeoCandidate
 */
function parseNominatimResult(result: NominatimResult): GeoCandidate {
  const components: AddressComponents = {
    house_number: result.address.house_number,
    road: result.address.road,
    neighbourhood: result.address.neighbourhood,
    suburb: result.address.suburb,
    city: result.address.city,
    town: result.address.town,
    village: result.address.village,
    municipality: result.address.municipality,
    county: result.address.county,
    state: result.address.state,
    province: result.address.province,
    postcode: result.address.postcode,
    country: result.address.country,
    country_code: result.address.country_code,
  };
  
  // Clean undefined values
  Object.keys(components).forEach(key => {
    if ((components as any)[key] === undefined) {
      delete (components as any)[key];
    }
  });
  
  const { hash } = normalizeAndHashAddress(result.display_name);
  
  return {
    formattedAddress: result.display_name,
    components,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    provider: 'nominatim',
    providerPlaceId: `osm:${result.osm_type}:${result.osm_id}`,
    confidence: calculateConfidence(components),
    normalizedAddressHash: hash,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Reverse geocode: coordinates → address candidates
 * 
 * @param lat Latitude
 * @param lng Longitude
 * @returns Array of GeoCandidate (usually 1 for reverse)
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeoCandidate[]> {
  // Check cache
  const cacheKey = `reverse:${lat.toFixed(6)}:${lng.toFixed(6)}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    await enforceRateLimit();
    
    const url = new URL(`${NOMINATIM_BASE}/reverse`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lng.toString());
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', '18'); // Building level
    
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[Geocode] Reverse geocode failed: ${response.status}`);
      return [];
    }
    
    const data = await response.json() as NominatimResult;
    
    // Nominatim returns single result for reverse
    if (data && data.display_name) {
      const candidates = [parseNominatimResult(data)];
      storeInCache(cacheKey, candidates);
      return candidates;
    }
    
    return [];
  } catch (error) {
    console.error('[Geocode] Reverse geocode error:', error);
    return [];
  }
}

/**
 * Forward geocode: address query → coordinate candidates
 * 
 * @param query Address search string
 * @param options Optional search options
 * @returns Array of GeoCandidate (up to 10)
 */
export async function forwardGeocode(
  query: string,
  options?: {
    countryCode?: string;
    limit?: number;
  }
): Promise<GeoCandidate[]> {
  if (!query || query.trim().length < 3) {
    return [];
  }
  
  // Check cache
  const cacheKey = `forward:${query.toLowerCase().trim()}:${options?.countryCode || ''}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    await enforceRateLimit();
    
    const url = new URL(`${NOMINATIM_BASE}/search`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', query);
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', String(options?.limit || 10));
    
    if (options?.countryCode) {
      url.searchParams.set('countrycodes', options.countryCode);
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[Geocode] Forward geocode failed: ${response.status}`);
      return [];
    }
    
    const data = await response.json() as NominatimResult[];
    
    if (Array.isArray(data)) {
      const candidates = data.map(parseNominatimResult);
      storeInCache(cacheKey, candidates);
      return candidates;
    }
    
    return [];
  } catch (error) {
    console.error('[Geocode] Forward geocode error:', error);
    return [];
  }
}

/**
 * Calculate distance between two coordinates in meters
 * Using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
