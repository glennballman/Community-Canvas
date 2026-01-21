/**
 * A2.4: Address Resolution Engine
 * 
 * Matches geocoded place candidates against the contractor's business graph:
 * - Existing customers
 * - Existing jobsites
 * - Work requests
 * 
 * Returns matches and proposals but NEVER auto-creates entities.
 */

import { db } from '../db';
import { 
  ccGeoPlaceCandidates, 
  ccGeoEntityLinks,
  ccContractorCustomers,
  ccContractorJobsites,
  GeoPlaceCandidate,
  GeoEntityLink,
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { calculateDistanceMeters, GeoCandidate } from './geocodeService';

// ============================================================================
// TYPES
// ============================================================================

export interface EntityMatch {
  entityType: 'customer' | 'jobsite' | 'work_request';
  entityId: string;
  matchType: 'exact_hash' | 'proximity' | 'contact_match';
  confidence: number;
  label: string;
}

export interface DraftProposal {
  type: 'create_customer' | 'create_jobsite' | 'attach_to_existing';
  suggestedData: Record<string, any>;
  reason: string;
}

export interface ResolutionResult {
  candidates: GeoPlaceCandidate[];
  matches: EntityMatch[];
  proposals: DraftProposal[];
  reasoning: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROXIMITY_THRESHOLD_METERS = 120; // Match if within 120m

// ============================================================================
// RESOLUTION ENGINE
// ============================================================================

/**
 * Resolve geo candidates against contractor's business graph
 * 
 * @param tenantId Tenant ID
 * @param contractorProfileId Contractor profile ID
 * @param candidates Geocoded candidates to resolve
 * @param context Optional context (ingestionId, photoBundleId)
 */
export async function resolveGeoToBusinessGraph(
  tenantId: string,
  contractorProfileId: string,
  candidates: GeoCandidate[],
  context?: {
    ingestionId?: string;
    photoBundleId?: string;
    extractedContacts?: { phone?: string; email?: string; name?: string }[];
  }
): Promise<ResolutionResult> {
  const reasoning: string[] = [];
  const matches: EntityMatch[] = [];
  const proposals: DraftProposal[] = [];
  
  if (candidates.length === 0) {
    reasoning.push('No candidates provided for resolution');
    return { candidates: [], matches, proposals, reasoning };
  }
  
  reasoning.push(`Resolving ${candidates.length} geo candidate(s) against business graph`);
  
  // 1. Get all confirmed geo entity links for this contractor
  const confirmedLinks = await db
    .select()
    .from(ccGeoEntityLinks)
    .where(and(
      eq(ccGeoEntityLinks.tenantId, tenantId),
      eq(ccGeoEntityLinks.contractorProfileId, contractorProfileId),
      eq(ccGeoEntityLinks.confirmed, true)
    ));
  
  reasoning.push(`Found ${confirmedLinks.length} confirmed geo entity links`);
  
  // 2. Get all existing jobsites with coordinates
  const jobsites = await db
    .select()
    .from(ccContractorJobsites)
    .where(and(
      eq(ccContractorJobsites.tenantId, tenantId),
      eq(ccContractorJobsites.contractorProfileId, contractorProfileId),
      eq(ccContractorJobsites.isActive, true)
    ));
  
  // 3. Get all existing customers
  const customers = await db
    .select()
    .from(ccContractorCustomers)
    .where(and(
      eq(ccContractorCustomers.tenantId, tenantId),
      eq(ccContractorCustomers.contractorProfileId, contractorProfileId),
      eq(ccContractorCustomers.isActive, true)
    ));
  
  // 4. Check each candidate for matches
  for (const candidate of candidates) {
    // 4a. Exact hash match against confirmed links
    const hashMatch = confirmedLinks.find(
      link => link.normalizedAddressHash === candidate.normalizedAddressHash
    );
    
    if (hashMatch) {
      reasoning.push(`Exact hash match found for "${candidate.formattedAddress}" → ${hashMatch.entityType}:${hashMatch.entityId}`);
      
      // Get entity label
      let label = hashMatch.formattedAddress;
      if (hashMatch.entityType === 'customer') {
        const cust = customers.find(c => c.id === hashMatch.entityId);
        label = cust?.name || hashMatch.formattedAddress;
      } else if (hashMatch.entityType === 'jobsite') {
        const js = jobsites.find(j => j.id === hashMatch.entityId);
        label = js?.confirmedAddress || js?.proposedAddress || hashMatch.formattedAddress;
      }
      
      matches.push({
        entityType: hashMatch.entityType as 'customer' | 'jobsite' | 'work_request',
        entityId: hashMatch.entityId,
        matchType: 'exact_hash',
        confidence: 95,
        label,
      });
      continue;
    }
    
    // 4b. Proximity match against confirmed links with coordinates
    if (candidate.lat && candidate.lng) {
      for (const link of confirmedLinks) {
        if (link.lat && link.lng) {
          const distance = calculateDistanceMeters(
            candidate.lat,
            candidate.lng,
            parseFloat(link.lat),
            parseFloat(link.lng)
          );
          
          if (distance <= PROXIMITY_THRESHOLD_METERS) {
            reasoning.push(`Proximity match (${Math.round(distance)}m) for "${candidate.formattedAddress}" → ${link.entityType}:${link.entityId}`);
            
            let label = link.formattedAddress;
            if (link.entityType === 'customer') {
              const cust = customers.find(c => c.id === link.entityId);
              label = cust?.name || link.formattedAddress;
            } else if (link.entityType === 'jobsite') {
              const js = jobsites.find(j => j.id === link.entityId);
              label = js?.confirmedAddress || js?.proposedAddress || link.formattedAddress;
            }
            
            matches.push({
              entityType: link.entityType as 'customer' | 'jobsite' | 'work_request',
              entityId: link.entityId,
              matchType: 'proximity',
              confidence: Math.max(50, 90 - (distance / 2)),
              label,
            });
          }
        }
      }
      
      // 4c. Proximity match against jobsites with coordinates
      for (const jobsite of jobsites) {
        if (jobsite.geoLat && jobsite.geoLng) {
          const distance = calculateDistanceMeters(
            candidate.lat,
            candidate.lng,
            parseFloat(jobsite.geoLat),
            parseFloat(jobsite.geoLng)
          );
          
          if (distance <= PROXIMITY_THRESHOLD_METERS) {
            // Check if already matched
            const alreadyMatched = matches.some(
              m => m.entityType === 'jobsite' && m.entityId === jobsite.id
            );
            
            if (!alreadyMatched) {
              reasoning.push(`Jobsite proximity match (${Math.round(distance)}m) for "${candidate.formattedAddress}" → jobsite:${jobsite.id}`);
              
              matches.push({
                entityType: 'jobsite',
                entityId: jobsite.id,
                matchType: 'proximity',
                confidence: Math.max(50, 85 - (distance / 2)),
                label: jobsite.confirmedAddress || jobsite.proposedAddress || 'Unnamed jobsite',
              });
            }
          }
        }
      }
    }
  }
  
  // 5. Contact matching (email/phone from OCR)
  if (context?.extractedContacts && context.extractedContacts.length > 0) {
    for (const contact of context.extractedContacts) {
      if (contact.email) {
        const emailMatch = customers.find(
          c => c.email?.toLowerCase() === contact.email?.toLowerCase()
        );
        if (emailMatch) {
          const alreadyMatched = matches.some(
            m => m.entityType === 'customer' && m.entityId === emailMatch.id
          );
          if (!alreadyMatched) {
            reasoning.push(`Email match: ${contact.email} → customer:${emailMatch.id}`);
            matches.push({
              entityType: 'customer',
              entityId: emailMatch.id,
              matchType: 'contact_match',
              confidence: 90,
              label: emailMatch.name || contact.email,
            });
          }
        }
      }
      
      if (contact.phone) {
        // Normalize phone for comparison
        const normalizedPhone = contact.phone.replace(/\D/g, '');
        const phoneMatch = customers.find(c => {
          const custPhone = c.phone?.replace(/\D/g, '');
          return custPhone && custPhone === normalizedPhone;
        });
        
        if (phoneMatch) {
          const alreadyMatched = matches.some(
            m => m.entityType === 'customer' && m.entityId === phoneMatch.id
          );
          if (!alreadyMatched) {
            reasoning.push(`Phone match: ${contact.phone} → customer:${phoneMatch.id}`);
            matches.push({
              entityType: 'customer',
              entityId: phoneMatch.id,
              matchType: 'contact_match',
              confidence: 85,
              label: phoneMatch.name || contact.phone,
            });
          }
        }
      }
    }
  }
  
  // 6. Generate proposals if no matches
  if (matches.length === 0 && candidates.length > 0) {
    const topCandidate = candidates.reduce((best, c) => 
      c.confidence > best.confidence ? c : best
    , candidates[0]);
    
    reasoning.push(`No matches found. Proposing drafts based on top candidate: "${topCandidate.formattedAddress}"`);
    
    // Propose jobsite creation
    proposals.push({
      type: 'create_jobsite',
      suggestedData: {
        proposedAddress: topCandidate.formattedAddress,
        geoLat: topCandidate.lat,
        geoLng: topCandidate.lng,
        addressConfidence: topCandidate.confidence / 100,
      },
      reason: 'No existing jobsite matches this location',
    });
    
    // If we have contact info, propose customer creation
    if (context?.extractedContacts && context.extractedContacts.length > 0) {
      const contact = context.extractedContacts[0];
      proposals.push({
        type: 'create_customer',
        suggestedData: {
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          address: topCandidate.formattedAddress,
        },
        reason: 'Contact info extracted but no matching customer found',
      });
    }
  }
  
  // Deduplicate matches by entity
  const uniqueMatches = matches.reduce((acc, match) => {
    const key = `${match.entityType}:${match.entityId}`;
    if (!acc.has(key) || acc.get(key)!.confidence < match.confidence) {
      acc.set(key, match);
    }
    return acc;
  }, new Map<string, EntityMatch>());
  
  return {
    candidates: [], // Caller should use stored candidates
    matches: Array.from(uniqueMatches.values()),
    proposals,
    reasoning,
  };
}

/**
 * Store geo candidates in database
 */
export async function storeCandidates(
  tenantId: string,
  contractorProfileId: string,
  candidates: GeoCandidate[],
  context: {
    ingestionId?: string;
    photoBundleId?: string;
    source: 'exif' | 'ocr' | 'manual' | 'inferred';
  }
): Promise<GeoPlaceCandidate[]> {
  if (candidates.length === 0) return [];
  
  const toInsert = candidates.map(c => ({
    tenantId,
    contractorProfileId,
    ingestionId: context.ingestionId || null,
    photoBundleId: context.photoBundleId || null,
    source: context.source,
    lat: c.lat?.toString() || null,
    lng: c.lng?.toString() || null,
    formattedAddress: c.formattedAddress,
    addressComponents: c.components,
    confidence: c.confidence.toString(),
    provider: c.provider,
    providerPlaceId: c.providerPlaceId,
    normalizedAddressHash: c.normalizedAddressHash,
  }));
  
  const inserted = await db
    .insert(ccGeoPlaceCandidates)
    .values(toInsert)
    .returning();
  
  return inserted;
}

/**
 * Confirm a geo entity link
 */
export async function confirmGeoLink(
  tenantId: string,
  contractorProfileId: string,
  entityType: 'customer' | 'jobsite' | 'work_request',
  entityId: string,
  candidateId: string | null,
  manualAddress: string | null,
  coordinates: { lat: number; lng: number } | null,
  confirmedBy: string
): Promise<GeoEntityLink> {
  // Get address info from candidate or manual entry
  let formattedAddress: string;
  let normalizedAddressHash: string;
  let lat: string | null = null;
  let lng: string | null = null;
  
  if (candidateId) {
    // Use candidate data
    const [candidate] = await db
      .select()
      .from(ccGeoPlaceCandidates)
      .where(eq(ccGeoPlaceCandidates.id, candidateId));
    
    if (!candidate) {
      throw new Error('Candidate not found');
    }
    
    formattedAddress = candidate.formattedAddress;
    normalizedAddressHash = candidate.normalizedAddressHash;
    lat = candidate.lat;
    lng = candidate.lng;
    
    // Mark candidate as accepted
    await db
      .update(ccGeoPlaceCandidates)
      .set({ acceptedAt: new Date(), acceptedBy: confirmedBy })
      .where(eq(ccGeoPlaceCandidates.id, candidateId));
  } else if (manualAddress) {
    // Use manual address
    const { normalizeAndHashAddress } = await import('./normalizeAddress');
    const { hash } = normalizeAndHashAddress(manualAddress);
    formattedAddress = manualAddress;
    normalizedAddressHash = hash;
    if (coordinates) {
      lat = coordinates.lat.toString();
      lng = coordinates.lng.toString();
    }
  } else {
    throw new Error('Either candidateId or manualAddress must be provided');
  }
  
  // Upsert geo entity link
  const [link] = await db
    .insert(ccGeoEntityLinks)
    .values({
      tenantId,
      contractorProfileId,
      entityType,
      entityId,
      normalizedAddressHash,
      formattedAddress,
      lat,
      lng,
      confirmed: true,
      confirmedBy,
      confirmedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        ccGeoEntityLinks.tenantId, 
        ccGeoEntityLinks.contractorProfileId, 
        ccGeoEntityLinks.entityType, 
        ccGeoEntityLinks.entityId
      ],
      set: {
        normalizedAddressHash,
        formattedAddress,
        lat,
        lng,
        confirmed: true,
        confirmedBy,
        confirmedAt: new Date(),
      },
    })
    .returning();
  
  return link;
}

/**
 * Deny a geo candidate
 */
export async function denyCandidate(
  candidateId: string,
  deniedBy: string
): Promise<void> {
  await db
    .update(ccGeoPlaceCandidates)
    .set({ deniedAt: new Date(), deniedBy })
    .where(eq(ccGeoPlaceCandidates.id, candidateId));
}

/**
 * Get candidates for an ingestion or photo bundle
 */
export async function getCandidatesForContext(
  tenantId: string,
  contractorProfileId: string,
  context: { ingestionId?: string; photoBundleId?: string }
): Promise<GeoPlaceCandidate[]> {
  if (context.ingestionId) {
    return db
      .select()
      .from(ccGeoPlaceCandidates)
      .where(and(
        eq(ccGeoPlaceCandidates.tenantId, tenantId),
        eq(ccGeoPlaceCandidates.contractorProfileId, contractorProfileId),
        eq(ccGeoPlaceCandidates.ingestionId, context.ingestionId)
      ));
  }
  
  if (context.photoBundleId) {
    return db
      .select()
      .from(ccGeoPlaceCandidates)
      .where(and(
        eq(ccGeoPlaceCandidates.tenantId, tenantId),
        eq(ccGeoPlaceCandidates.contractorProfileId, contractorProfileId),
        eq(ccGeoPlaceCandidates.photoBundleId, context.photoBundleId)
      ));
  }
  
  return [];
}
