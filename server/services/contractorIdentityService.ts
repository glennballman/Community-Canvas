/**
 * Contractor Identity Service - Prompt A2.1
 * 
 * Extracts identity signals from vehicle/trailer photos and generates
 * privacy-safe identity proposals for contractor onboarding.
 * 
 * PRIVACY INVARIANTS:
 * - Never present addresses as facts - use "Photo captured near..." language
 * - Never store raw license plates - only plate_region and optional hash
 * - Web lookups require explicit consent
 * - All proposals are suggestions until confirmed
 */

import { pool } from '../db.js';

// Types for identity signals and proposals
export interface IdentitySignals {
  detected_company_name?: string;
  detected_phone?: string;
  detected_domain?: string;
  detected_social?: string[];
  plate_region?: string;
  gps?: { lat: number; lng: number; captured_at?: string } | null;
}

export interface IdentityProposalEvidence {
  type: 'ocr_domain' | 'ocr_phone' | 'ocr_name' | 'ocr_social' | 'gps_hint' | 'plate_region';
  value: string;
}

export interface IdentityProposal {
  company_name?: string;
  phone?: string;
  website?: string;
  location_hint?: string;
  likely_person?: string;
  confidence: number;
  evidence: IdentityProposalEvidence[];
  requires_consent_for_web_lookup: boolean;
  web_enrichment?: WebEnrichmentResult;
}

export interface WebEnrichmentResult {
  website_title?: string;
  logo_url?: string;
  brand_colors?: string[];
  about_snippet?: string;
  fetched_at: string;
}

export interface MediaItem {
  url: string;
  mime?: string;
  bytes?: number;
  width?: number;
  height?: number;
  captured_at?: string;
  gps?: { lat: number; lng: number } | null;
}

/**
 * Extract identity signals from uploaded media
 * 
 * Currently returns stub data. Will integrate with AI/OCR in future prompts.
 * GPS data is extracted from EXIF if present.
 */
export async function extractIdentitySignalsFromMedia(
  images: MediaItem[]
): Promise<IdentitySignals> {
  const signals: IdentitySignals = {};
  
  // Check for GPS in any of the images
  for (const img of images) {
    if (img.gps?.lat && img.gps?.lng) {
      signals.gps = {
        lat: img.gps.lat,
        lng: img.gps.lng,
        captured_at: img.captured_at
      };
      break; // Use first GPS found
    }
  }
  
  // STUB: In future prompts, integrate with AI vision API for OCR
  // For now, return empty signals (no detections)
  // Real implementation would:
  // 1. Send images to AI vision API
  // 2. Extract text via OCR
  // 3. Parse phone numbers, domains, company names
  // 4. Detect license plate regions (not full plates)
  
  return signals;
}

/**
 * Generate location hint from GPS coordinates
 * Uses reverse geocoding or approximation
 */
async function generateLocationHint(gps: { lat: number; lng: number }): Promise<string | null> {
  // STUB: In production, use Mapbox/Google reverse geocoding
  // For now, generate approximate hint based on coordinates
  
  // Basic BC region detection
  const { lat, lng } = gps;
  
  if (lat >= 48 && lat <= 60 && lng >= -140 && lng <= -114) {
    // Rough BC area detection
    if (lat >= 52) {
      return 'Photo captured in northern British Columbia (GPS metadata)';
    } else if (lng <= -123) {
      return 'Photo captured on Vancouver Island or coastal BC (GPS metadata)';
    } else {
      return 'Photo captured in southern British Columbia (GPS metadata)';
    }
  }
  
  // Generic hint
  return `Photo captured at approximate location (${lat.toFixed(2)}, ${lng.toFixed(2)}) (GPS metadata)`;
}

/**
 * Create an identity proposal from extracted signals
 */
export async function proposeIdentityCandidate(
  signals: IdentitySignals,
  options?: { allow_web_lookup?: boolean }
): Promise<IdentityProposal> {
  const evidence: IdentityProposalEvidence[] = [];
  let confidence = 0;
  
  const proposal: IdentityProposal = {
    confidence: 0,
    evidence: [],
    requires_consent_for_web_lookup: false
  };
  
  // Build proposal from signals
  if (signals.detected_company_name) {
    proposal.company_name = signals.detected_company_name;
    evidence.push({ type: 'ocr_name', value: signals.detected_company_name });
    confidence += 25;
  }
  
  if (signals.detected_phone) {
    proposal.phone = signals.detected_phone;
    evidence.push({ type: 'ocr_phone', value: signals.detected_phone });
    confidence += 20;
  }
  
  if (signals.detected_domain) {
    proposal.website = signals.detected_domain.startsWith('http') 
      ? signals.detected_domain 
      : `https://${signals.detected_domain}`;
    evidence.push({ type: 'ocr_domain', value: signals.detected_domain });
    confidence += 25;
    proposal.requires_consent_for_web_lookup = true;
  }
  
  if (signals.detected_social && signals.detected_social.length > 0) {
    evidence.push(...signals.detected_social.map(s => ({
      type: 'ocr_social' as const,
      value: s
    })));
    confidence += 10;
  }
  
  if (signals.plate_region) {
    evidence.push({ type: 'plate_region', value: signals.plate_region });
    confidence += 5;
  }
  
  if (signals.gps) {
    const locationHint = await generateLocationHint(signals.gps);
    if (locationHint) {
      proposal.location_hint = locationHint;
      evidence.push({ type: 'gps_hint', value: locationHint });
      confidence += 10;
    }
  }
  
  proposal.evidence = evidence;
  proposal.confidence = Math.min(confidence / 100, 0.95); // Cap at 95%
  
  return proposal;
}

/**
 * Enrich identity proposal with web data (consent required)
 * 
 * ONLY call this if contractor explicitly consented
 */
export async function enrichFromWeb(
  websiteOrDomain: string
): Promise<WebEnrichmentResult | null> {
  try {
    // Normalize domain
    let url = websiteOrDomain;
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    
    // STUB: In production, fetch website and extract metadata
    // For now, return minimal stub data
    // Real implementation would:
    // 1. Fetch website with timeout
    // 2. Parse title, meta description
    // 3. Extract logo URL
    // 4. Detect brand colors from CSS/images
    
    return {
      website_title: 'Website content pending',
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('[ContractorIdentity] Web enrichment failed:', error);
    return null;
  }
}

/**
 * Update contractor profile with confirmed identity
 */
export async function confirmContractorIdentity(
  contractorProfileId: string,
  identity: {
    company_name?: string;
    phone?: string;
    website?: string;
    location_hint?: string;
    person_name?: string;
  }
): Promise<boolean> {
  try {
    await pool.query(`
      UPDATE cc_contractor_profiles
      SET
        company_name = COALESCE($2, company_name),
        company_phone = COALESCE($3, company_phone),
        company_website = COALESCE($4, company_website),
        company_location_hint = COALESCE($5, company_location_hint),
        identity_enrichment_state = 'confirmed',
        identity_enrichment_last_confirmed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [
      contractorProfileId,
      identity.company_name || null,
      identity.phone || null,
      identity.website || null,
      identity.location_hint || null
    ]);
    
    return true;
  } catch (error) {
    console.error('[ContractorIdentity] Failed to confirm identity:', error);
    return false;
  }
}

/**
 * Update enrichment state on contractor profile
 */
export async function updateEnrichmentState(
  contractorProfileId: string,
  state: 'not_started' | 'proposed' | 'confirmed' | 'denied' | 'dismissed'
): Promise<boolean> {
  try {
    const updateFields: string[] = [
      'identity_enrichment_state = $2',
      'updated_at = NOW()'
    ];
    
    if (state === 'proposed') {
      updateFields.push('identity_enrichment_last_proposed_at = NOW()');
    } else if (state === 'confirmed') {
      updateFields.push('identity_enrichment_last_confirmed_at = NOW()');
    }
    
    await pool.query(`
      UPDATE cc_contractor_profiles
      SET ${updateFields.join(', ')}
      WHERE id = $1
    `, [contractorProfileId, state]);
    
    return true;
  } catch (error) {
    console.error('[ContractorIdentity] Failed to update enrichment state:', error);
    return false;
  }
}

/**
 * Update ingestion identity proposal status
 */
export async function updateIngestionIdentityStatus(
  ingestionId: string,
  status: 'none' | 'proposed' | 'confirmed' | 'denied' | 'dismissed',
  proposal?: IdentityProposal
): Promise<boolean> {
  try {
    if (proposal) {
      await pool.query(`
        UPDATE cc_ai_ingestions
        SET
          identity_proposal = $2,
          identity_proposal_status = $3,
          updated_at = NOW()
        WHERE id = $1
      `, [ingestionId, JSON.stringify(proposal), status]);
    } else {
      await pool.query(`
        UPDATE cc_ai_ingestions
        SET
          identity_proposal_status = $2,
          updated_at = NOW()
        WHERE id = $1
      `, [ingestionId, status]);
    }
    
    return true;
  } catch (error) {
    console.error('[ContractorIdentity] Failed to update ingestion status:', error);
    return false;
  }
}
