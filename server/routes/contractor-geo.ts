/**
 * A2.4: Contractor Geo Resolution Routes
 * 
 * Endpoints for resolving geo coordinates/addresses against business graph.
 */

import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { 
  ccGeoPlaceCandidates, 
  ccGeoEntityLinks,
  ccAiIngestions,
  ccContractorPhotoBundles,
  ccContractorProfiles,
} from '@shared/schema';
import { authenticateToken } from '../middleware/auth';
import { can } from '../auth/authorize';
import { reverseGeocode, forwardGeocode, GeoCandidate } from '../services/geocodeService';
import { 
  resolveGeoToBusinessGraph, 
  storeCandidates,
  confirmGeoLink,
  denyCandidate,
  getCandidatesForContext,
} from '../services/addressResolutionEngine';

const router = Router();

// PROMPT-17B: Router-level authentication gate
router.use(authenticateToken);

/**
 * PROMPT-17B: Canonical 403 deny helper (AUTH_CONSTITUTION §8a)
 * Uses service_runs.own.* capabilities for contractor self-service operations
 */
function denyCapability(res: Response, capability: string): Response {
  return res.status(403).json({
    error: 'Forbidden',
    code: 'NOT_AUTHORIZED',
    capability,
    reason: 'capability_not_granted',
  });
}

/**
 * Helper to get contractor profile for current user
 */
async function getContractorProfile(userId: string, tenantId: string) {
  return db.query.ccContractorProfiles.findFirst({
    where: and(
      eq(ccContractorProfiles.userId, userId),
      eq(ccContractorProfiles.tenantId, tenantId)
    )
  });
}

/**
 * POST /api/contractor/geo/resolve
 * 
 * Resolve geo candidates for an ingestion or photo bundle.
 * - Fetches EXIF coordinates if available
 * - Forward geocodes OCR-extracted addresses
 * - Matches against contractor's business graph
 * - Returns candidates, matches, and proposals
 */
router.post('/resolve', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');

  try {
    const userId = (req as any).user?.userId;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const { ingestion_id, photo_bundle_id, force_recompute } = req.body;
    
    if (!ingestion_id && !photo_bundle_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Either ingestion_id or photo_bundle_id required' 
      });
    }
    
    // Get contractor profile
    const profile = await getContractorProfile(userId, tenantId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    // Check for existing candidates if not forcing recompute
    if (!force_recompute) {
      const existingCandidates = await getCandidatesForContext(
        tenantId, 
        profile.id,
        { ingestionId: ingestion_id, photoBundleId: photo_bundle_id }
      );
      
      if (existingCandidates.length > 0) {
        // Resolve against business graph with existing candidates
        const geoCandidates: GeoCandidate[] = existingCandidates.map(c => ({
          formattedAddress: c.formattedAddress,
          components: c.addressComponents as any,
          lat: c.lat ? parseFloat(c.lat) : null,
          lng: c.lng ? parseFloat(c.lng) : null,
          provider: c.provider || 'nominatim',
          providerPlaceId: c.providerPlaceId,
          confidence: parseFloat(c.confidence),
          normalizedAddressHash: c.normalizedAddressHash,
        }));
        
        const result = await resolveGeoToBusinessGraph(
          tenantId, 
          profile.id, 
          geoCandidates
        );
        
        return res.json({
          success: true,
          ok: true,
          candidates: existingCandidates.slice(0, 10),
          matches: result.matches,
          proposals: result.proposals,
          reasoning: result.reasoning,
        });
      }
    }
    
    // Get ingestion or bundle to extract geo data
    let geoInference: any = {};
    let extractedEntities: any = {};
    
    if (ingestion_id) {
      const [ingestion] = await db
        .select()
        .from(ccAiIngestions)
        .where(eq(ccAiIngestions.id, ingestion_id));
      
      if (ingestion) {
        geoInference = ingestion.geoInference || {};
        extractedEntities = ingestion.extractedEntities || {};
      }
    }
    
    // Collect all geo candidates
    const allCandidates: GeoCandidate[] = [];
    
    // 1. Reverse geocode from EXIF coordinates
    if (geoInference.lat && geoInference.lng) {
      const exifCandidates = await reverseGeocode(
        geoInference.lat, 
        geoInference.lng
      );
      allCandidates.push(...exifCandidates);
    }
    
    // 2. Forward geocode from OCR-extracted addresses
    const addresses = extractedEntities.addresses || [];
    for (const addr of addresses.slice(0, 3)) {
      const ocrCandidates = await forwardGeocode(addr, { countryCode: 'ca' });
      allCandidates.push(...ocrCandidates.slice(0, 3));
    }
    
    // 3. Store candidates in database
    if (allCandidates.length > 0) {
      await storeCandidates(
        tenantId,
        profile.id,
        allCandidates,
        {
          ingestionId: ingestion_id,
          photoBundleId: photo_bundle_id,
          source: geoInference.lat ? 'exif' : 'ocr',
        }
      );
    }
    
    // 4. Resolve against business graph
    const extractedContacts = extractedEntities.contacts || [];
    const result = await resolveGeoToBusinessGraph(
      tenantId,
      profile.id,
      allCandidates,
      {
        ingestionId: ingestion_id,
        photoBundleId: photo_bundle_id,
        extractedContacts,
      }
    );
    
    // 5. Get stored candidates for response
    const storedCandidates = await getCandidatesForContext(
      tenantId,
      profile.id,
      { ingestionId: ingestion_id, photoBundleId: photo_bundle_id }
    );
    
    return res.json({
      success: true,
      ok: true,
      candidates: storedCandidates.slice(0, 10),
      matches: result.matches,
      proposals: result.proposals,
      reasoning: result.reasoning,
    });
  } catch (error) {
    console.error('[GEO] Resolve error:', error);
    return res.status(500).json({ success: false, error: 'Failed to resolve geo' });
  }
});

/**
 * POST /api/contractor/geo/confirm
 * 
 * Confirm a geo candidate or entity link.
 * Two modes:
 * 1. Entity link: Links a candidate to a customer/jobsite/work_request (requires entity_type + entity_id)
 * 2. Candidate acceptance: Marks a candidate as accepted without linking (only candidate_id)
 */
router.post('/confirm', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');

  try {
    const userId = (req as any).user?.userId;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const { 
      entity_type, 
      entity_id, 
      candidate_id, 
      manual_address_text,
      lat,
      lng,
    } = req.body;
    
    // At least one of candidate_id or manual_address_text is required
    if (!candidate_id && !manual_address_text) {
      return res.status(400).json({ 
        success: false, 
        error: 'Either candidate_id or manual_address_text required' 
      });
    }
    
    // Get contractor profile
    const profile = await getContractorProfile(userId, tenantId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    // If we have entity_type and entity_id, create a full entity link
    if (entity_type && entity_id) {
      const link = await confirmGeoLink(
        tenantId,
        profile.id,
        entity_type,
        entity_id,
        candidate_id || null,
        manual_address_text || null,
        lat && lng ? { lat, lng } : null,
        userId
      );
      
      return res.json({
        success: true,
        ok: true,
        link,
        mode: 'entity_link'
      });
    }
    
    // Otherwise, just mark the candidate as accepted
    if (candidate_id) {
      await db
        .update(ccGeoPlaceCandidates)
        .set({
          acceptedAt: new Date(),
          acceptedBy: userId
        })
        .where(eq(ccGeoPlaceCandidates.id, candidate_id));
      
      return res.json({
        success: true,
        ok: true,
        mode: 'candidate_accepted',
        candidateId: candidate_id
      });
    }
    
    // Handle manual address confirmation (store new candidate)
    if (manual_address_text && lat && lng) {
      const { normalizeAddress } = await import('../services/normalizeAddress');
      const { normalized, hash } = normalizeAddress(manual_address_text);
      
      const [candidate] = await db
        .insert(ccGeoPlaceCandidates)
        .values({
          tenantId,
          contractorProfileId: profile.id,
          source: 'manual',
          lat: lat.toString(),
          lng: lng.toString(),
          formattedAddress: manual_address_text,
          addressComponents: { raw: manual_address_text },
          confidence: '80',
          provider: 'manual',
          normalizedAddressHash: hash,
          acceptedAt: new Date(),
          acceptedBy: userId
        })
        .returning();
      
      return res.json({
        success: true,
        ok: true,
        mode: 'manual_accepted',
        candidate
      });
    }
    
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid confirmation request - provide either candidate_id or manual_address_text with lat/lng' 
    });
  } catch (error) {
    console.error('[GEO] Confirm error:', error);
    return res.status(500).json({ success: false, error: 'Failed to confirm geo' });
  }
});

/**
 * POST /api/contractor/geo/deny
 * 
 * Deny a geo candidate.
 * The candidate is marked as denied but not deleted (for learning).
 */
router.post('/deny', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');

  try {
    const userId = (req as any).user?.userId;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const { candidate_id, ingestion_id, photo_bundle_id } = req.body;
    
    if (!candidate_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'candidate_id required' 
      });
    }
    
    // Deny the candidate
    await denyCandidate(candidate_id, userId);
    
    return res.json({
      success: true,
      ok: true,
    });
  } catch (error) {
    console.error('[GEO] Deny error:', error);
    return res.status(500).json({ success: false, error: 'Failed to deny candidate' });
  }
});

/**
 * POST /api/contractor/geo/search
 * 
 * Forward geocode an address query.
 * Used for manual address search in UI.
 */
router.post('/search', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.update for contractor mutating operations)
  if (!(await can(req, 'service_runs.own.update'))) return denyCapability(res, 'service_runs.own.update');

  try {
    const { query, country_code } = req.body;
    
    if (!query || query.length < 3) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query must be at least 3 characters' 
      });
    }
    
    const candidates = await forwardGeocode(query, { 
      countryCode: country_code || 'ca',
      limit: 10,
    });
    
    return res.json({
      success: true,
      ok: true,
      candidates,
    });
  } catch (error) {
    console.error('[GEO] Search error:', error);
    return res.status(500).json({ success: false, error: 'Failed to search address' });
  }
});

/**
 * GET /api/contractor/geo/candidates
 * 
 * Get candidates for an ingestion or photo bundle.
 */
router.get('/candidates', async (req: Request, res: Response) => {
  // PROMPT-17B: Capability gate (service_runs.own.read for contractor read operations)
  if (!(await can(req, 'service_runs.own.read'))) return denyCapability(res, 'service_runs.own.read');

  try {
    const userId = (req as any).user?.userId;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId || !tenantId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const { ingestion_id, photo_bundle_id } = req.query;
    
    // Get contractor profile
    const profile = await getContractorProfile(userId, tenantId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    const candidates = await getCandidatesForContext(
      tenantId,
      profile.id,
      { 
        ingestionId: ingestion_id as string, 
        photoBundleId: photo_bundle_id as string 
      }
    );
    
    return res.json({
      success: true,
      candidates,
    });
  } catch (error) {
    console.error('[GEO] Get candidates error:', error);
    return res.status(500).json({ success: false, error: 'Failed to get candidates' });
  }
});

export default router;
