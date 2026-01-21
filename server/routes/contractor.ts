/**
 * Contractor Routes - Prompt A1: Contractor Onboarding Entry Point
 * 
 * Routes for contractor profile management and onboarding state tracking.
 * Camera-first onboarding experience with no forms required.
 */

import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db, pool } from '../db';
import { ccContractorProfiles, ccAiIngestions } from '@shared/schema';
import { authenticateToken } from '../middleware/auth';
import {
  extractIdentitySignalsFromMedia,
  proposeIdentityCandidate,
  enrichFromWeb,
  confirmContractorIdentity,
  updateEnrichmentState,
  updateIngestionIdentityStatus,
  type MediaItem,
  type IdentityProposal
} from '../services/contractorIdentityService.js';

const router = Router();

/**
 * GET /api/contractor/profile
 * Get contractor profile with onboarding state for current user
 * Creates profile if it doesn't exist (auto-provisioning)
 */
router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    if (!portalId) {
      return res.status(400).json({ success: false, error: 'Portal ID required' });
    }
    
    // Try to find existing profile
    let profile = await db.query.ccContractorProfiles.findFirst({
      where: and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      )
    });
    
    // Auto-create profile if doesn't exist (but don't set onboardingStartedAt yet)
    if (!profile) {
      const [newProfile] = await db.insert(ccContractorProfiles).values({
        userId,
        portalId,
        tenantId: tenantId || null,
        onboardingComplete: false,
        onboardingStartedAt: null, // Set by start-onboarding endpoint
        contractorRole: 'contractor_worker',
      }).returning();
      
      profile = newProfile;
      
      console.log(`[CONTRACTOR] Auto-created profile for user ${userId} in portal ${portalId}`);
    }
    
    return res.json({
      success: true,
      profile: {
        id: profile.id,
        userId: profile.userId,
        portalId: profile.portalId,
        onboardingComplete: profile.onboardingComplete,
        onboardingStartedAt: profile.onboardingStartedAt,
        onboardingCompletedAt: profile.onboardingCompletedAt,
        vehicleStarted: profile.vehicleStarted,
        toolsStarted: profile.toolsStarted,
        stickyNoteStarted: profile.stickyNoteStarted,
        contractorRole: profile.contractorRole,
        onboardingThreadId: profile.onboardingThreadId,
      }
    });
  } catch (error) {
    console.error('[CONTRACTOR] Error fetching profile:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch contractor profile' });
  }
});

/**
 * PATCH /api/contractor/profile/onboarding
 * Update onboarding progress (which steps have been started)
 */
router.patch('/profile/onboarding', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { vehicleStarted, toolsStarted, stickyNoteStarted } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    if (!portalId) {
      return res.status(400).json({ success: false, error: 'Portal ID required' });
    }
    
    const updates: Partial<typeof ccContractorProfiles.$inferInsert> = {
      updatedAt: new Date(),
    };
    
    if (typeof vehicleStarted === 'boolean') updates.vehicleStarted = vehicleStarted;
    if (typeof toolsStarted === 'boolean') updates.toolsStarted = toolsStarted;
    if (typeof stickyNoteStarted === 'boolean') updates.stickyNoteStarted = stickyNoteStarted;
    
    const [updated] = await db.update(ccContractorProfiles)
      .set(updates)
      .where(and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    console.log(`[CONTRACTOR] Onboarding progress updated for user ${userId}`);
    
    return res.json({
      success: true,
      profile: updated
    });
  } catch (error) {
    console.error('[CONTRACTOR] Error updating onboarding:', error);
    return res.status(500).json({ success: false, error: 'Failed to update onboarding progress' });
  }
});

/**
 * POST /api/contractor/profile/complete-onboarding
 * Mark onboarding as complete (skip or finish)
 */
router.post('/profile/complete-onboarding', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    if (!portalId) {
      return res.status(400).json({ success: false, error: 'Portal ID required' });
    }
    
    const [updated] = await db.update(ccContractorProfiles)
      .set({
        onboardingComplete: true,
        onboardingCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      ))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    console.log(`[CONTRACTOR] Onboarding completed for user ${userId}`);
    
    return res.json({
      success: true,
      profile: updated
    });
  } catch (error) {
    console.error('[CONTRACTOR] Error completing onboarding:', error);
    return res.status(500).json({ success: false, error: 'Failed to complete onboarding' });
  }
});

/**
 * POST /api/contractor/profile/start-onboarding
 * Initialize onboarding thread and mark start time
 * 
 * Messaging Integration (Prompt A1):
 * - Creates system audit log entry for visibility
 * - Full DM thread creation will be added in future prompts
 */
router.post('/profile/start-onboarding', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    if (!portalId) {
      return res.status(400).json({ success: false, error: 'Portal ID required' });
    }
    
    // Check if profile already exists
    let profile = await db.query.ccContractorProfiles.findFirst({
      where: and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      )
    });
    
    const isFirstVisit = !profile;
    
    if (!profile) {
      // Create new profile
      const [newProfile] = await db.insert(ccContractorProfiles).values({
        userId,
        portalId,
        tenantId: tenantId || null,
        onboardingComplete: false,
        onboardingStartedAt: new Date(),
        contractorRole: 'contractor_worker',
      }).returning();
      
      profile = newProfile;
      
      // System audit log for first visit (Prompt A1 messaging requirement)
      // This creates visibility and audit trail without needing full DM infrastructure
      console.log(`[CONTRACTOR AUDIT] contractor_onboarding_started | user=${userId} | portal=${portalId} | message="Contractor onboarding started."`);
    }
    
    return res.json({
      success: true,
      profile: {
        id: profile.id,
        userId: profile.userId,
        portalId: profile.portalId,
        onboardingComplete: profile.onboardingComplete,
        onboardingStartedAt: profile.onboardingStartedAt,
        vehicleStarted: profile.vehicleStarted,
        toolsStarted: profile.toolsStarted,
        stickyNoteStarted: profile.stickyNoteStarted,
      },
      isFirstVisit,
      message: isFirstVisit ? 'Contractor onboarding started.' : 'Contractor profile loaded.'
    });
  } catch (error) {
    console.error('[CONTRACTOR] Error starting onboarding:', error);
    return res.status(500).json({ success: false, error: 'Failed to start onboarding' });
  }
});

// =============================================================================
// A2.1: Identity Enrichment Routes
// =============================================================================

/**
 * POST /api/contractor/profile/identity/propose
 * Generate identity proposal from ingestion media
 * 
 * Privacy: Only uses visible content (OCR) by default.
 * Web lookup requires explicit consent via allow_web_lookup flag.
 */
router.post('/profile/identity/propose', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { ingestion_id, allow_web_lookup = false } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    if (!ingestion_id) {
      return res.status(400).json({ success: false, error: 'ingestion_id required' });
    }
    
    // Get contractor profile
    const profile = await db.query.ccContractorProfiles.findFirst({
      where: and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      )
    });
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    // Get ingestion and verify ownership
    const ingestion = await db.query.ccAiIngestions.findFirst({
      where: and(
        eq(ccAiIngestions.id, ingestion_id),
        eq(ccAiIngestions.contractorProfileId, profile.id)
      )
    });
    
    if (!ingestion) {
      return res.status(404).json({ success: false, error: 'Ingestion not found' });
    }
    
    // Only process vehicle photos for identity enrichment
    if (ingestion.sourceType !== 'vehicle_photo') {
      return res.status(400).json({ 
        success: false, 
        error: 'Identity proposal only available for vehicle photos' 
      });
    }
    
    // Extract signals from media
    const mediaItems = (ingestion.media as MediaItem[]) || [];
    const signals = await extractIdentitySignalsFromMedia(mediaItems);
    
    // Generate proposal
    const proposal = await proposeIdentityCandidate(signals, { allow_web_lookup });
    
    // Update ingestion with proposal
    await updateIngestionIdentityStatus(ingestion_id, 'proposed', proposal);
    
    // Update profile state
    await updateEnrichmentState(profile.id, 'proposed');
    
    console.log(`[CONTRACTOR IDENTITY] Proposal generated for user ${userId}, confidence=${proposal.confidence}`);
    
    return res.json({
      success: true,
      proposal,
      message: proposal.evidence.length > 0 
        ? 'Possible match found based on visible content'
        : 'No identity signals detected. You can enter details manually.'
    });
  } catch (error) {
    console.error('[CONTRACTOR IDENTITY] Error generating proposal:', error);
    return res.status(500).json({ success: false, error: 'Failed to generate identity proposal' });
  }
});

/**
 * POST /api/contractor/profile/identity/enrich-web
 * Fetch additional metadata from detected website (consent required)
 */
router.post('/profile/identity/enrich-web', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { ingestion_id, domain_or_website } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    if (!domain_or_website) {
      return res.status(400).json({ success: false, error: 'domain_or_website required' });
    }
    
    // Get contractor profile
    const profile = await db.query.ccContractorProfiles.findFirst({
      where: and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      )
    });
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    // Fetch web enrichment (consent given by calling this endpoint)
    const enrichment = await enrichFromWeb(domain_or_website);
    
    if (!enrichment) {
      return res.json({
        success: true,
        enrichment: null,
        message: 'Could not fetch website metadata. You can still enter details manually.'
      });
    }
    
    // If ingestion_id provided, update proposal with enrichment
    if (ingestion_id) {
      const ingestion = await db.query.ccAiIngestions.findFirst({
        where: and(
          eq(ccAiIngestions.id, ingestion_id),
          eq(ccAiIngestions.contractorProfileId, profile.id)
        )
      });
      
      if (ingestion) {
        const existingProposal = (ingestion.identityProposal as IdentityProposal) || {};
        const updatedProposal: IdentityProposal = {
          ...existingProposal,
          web_enrichment: enrichment,
          confidence: Math.min((existingProposal.confidence || 0) + 0.1, 0.95)
        };
        await updateIngestionIdentityStatus(ingestion_id, 'proposed', updatedProposal);
      }
    }
    
    console.log(`[CONTRACTOR IDENTITY] Web enrichment fetched for ${domain_or_website}`);
    
    return res.json({
      success: true,
      enrichment,
      message: 'Website metadata retrieved'
    });
  } catch (error) {
    console.error('[CONTRACTOR IDENTITY] Error enriching from web:', error);
    return res.status(500).json({ success: false, error: 'Failed to enrich from web' });
  }
});

/**
 * POST /api/contractor/profile/identity/confirm
 * Confirm identity proposal and update profile with contractor's confirmed identity
 */
router.post('/profile/identity/confirm', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { ingestion_id, company_name, phone, website, location_hint, person_name } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    // Get contractor profile
    const profile = await db.query.ccContractorProfiles.findFirst({
      where: and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      )
    });
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    // Update profile with confirmed identity
    const confirmed = await confirmContractorIdentity(profile.id, {
      company_name,
      phone,
      website,
      location_hint,
      person_name
    });
    
    if (!confirmed) {
      return res.status(500).json({ success: false, error: 'Failed to confirm identity' });
    }
    
    // Update ingestion status if provided
    if (ingestion_id) {
      await updateIngestionIdentityStatus(ingestion_id, 'confirmed');
    }
    
    console.log(`[CONTRACTOR IDENTITY] Identity confirmed for user ${userId}: ${company_name || 'unnamed'}`);
    
    return res.json({
      success: true,
      message: 'Identity confirmed successfully',
      confirmed_identity: {
        company_name,
        phone,
        website,
        location_hint
      }
    });
  } catch (error) {
    console.error('[CONTRACTOR IDENTITY] Error confirming identity:', error);
    return res.status(500).json({ success: false, error: 'Failed to confirm identity' });
  }
});

/**
 * POST /api/contractor/profile/identity/deny
 * Deny proposal - do not keep proposing automatically
 */
router.post('/profile/identity/deny', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { ingestion_id } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    // Get contractor profile
    const profile = await db.query.ccContractorProfiles.findFirst({
      where: and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      )
    });
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    // Update profile state
    await updateEnrichmentState(profile.id, 'denied');
    
    // Update ingestion status if provided
    if (ingestion_id) {
      await updateIngestionIdentityStatus(ingestion_id, 'denied');
    }
    
    console.log(`[CONTRACTOR IDENTITY] Identity proposal denied for user ${userId}`);
    
    return res.json({
      success: true,
      message: 'Identity proposal denied. We won\'t suggest this again unless you upload new photos.'
    });
  } catch (error) {
    console.error('[CONTRACTOR IDENTITY] Error denying identity:', error);
    return res.status(500).json({ success: false, error: 'Failed to deny identity' });
  }
});

/**
 * POST /api/contractor/profile/identity/dismiss
 * Dismiss for now - contractor just wants to view work request
 */
router.post('/profile/identity/dismiss', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const { ingestion_id } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    // Get contractor profile
    const profile = await db.query.ccContractorProfiles.findFirst({
      where: and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      )
    });
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    // Update profile state - dismissed means skip for now
    await updateEnrichmentState(profile.id, 'dismissed');
    
    // Update ingestion status if provided
    if (ingestion_id) {
      await updateIngestionIdentityStatus(ingestion_id, 'dismissed');
    }
    
    console.log(`[CONTRACTOR IDENTITY] Identity proposal dismissed for user ${userId}`);
    
    return res.json({
      success: true,
      message: 'Identity setup dismissed. You can complete this later.'
    });
  } catch (error) {
    console.error('[CONTRACTOR IDENTITY] Error dismissing identity:', error);
    return res.status(500).json({ success: false, error: 'Failed to dismiss identity' });
  }
});

/**
 * GET /api/contractor/profile/identity
 * Get current identity enrichment state and confirmed identity
 */
router.get('/profile/identity', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    // Get contractor profile with identity fields
    const profile = await db.query.ccContractorProfiles.findFirst({
      where: and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      )
    });
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    return res.json({
      success: true,
      identity: {
        state: profile.identityEnrichmentState,
        company_name: profile.companyName,
        phone: profile.companyPhone,
        website: profile.companyWebsite,
        location_hint: profile.companyLocationHint,
        brand_hints: profile.brandHints,
        last_proposed_at: profile.identityEnrichmentLastProposedAt,
        last_confirmed_at: profile.identityEnrichmentLastConfirmedAt
      }
    });
  } catch (error) {
    console.error('[CONTRACTOR IDENTITY] Error fetching identity:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch identity' });
  }
});

// ============================================================================
// A2.2: Service Area & Route Intelligence Endpoints
// ============================================================================

import {
  proposeServiceAreas,
  confirmServiceAreas,
  getContractorServiceAreas,
  updateServiceAreaPublishState,
  deactivateServiceArea,
  ServiceAreaProposal
} from '../services/contractorServiceAreaInference.js';

/**
 * POST /api/contractor/profile/service-areas/propose
 * Generate service area proposals from all available signals
 */
router.post('/profile/service-areas/propose', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    // Get contractor profile
    const profile = await db.query.ccContractorProfiles.findFirst({
      where: and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      )
    });
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    // Generate proposals
    const proposals = await proposeServiceAreas(profile.id, tenantId, portalId);
    
    return res.json({
      success: true,
      proposals,
      message: proposals.length > 0 
        ? `Found ${proposals.length} potential service area(s)`
        : 'No service areas detected yet. Upload more photos or job site images to help us understand where you work.'
    });
  } catch (error) {
    console.error('[CONTRACTOR SERVICE AREAS] Error proposing areas:', error);
    return res.status(500).json({ success: false, error: 'Failed to propose service areas' });
  }
});

/**
 * POST /api/contractor/profile/service-areas/confirm
 * Confirm, modify, or dismiss service area proposals
 */
router.post('/profile/service-areas/confirm', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    const { accepted, modified, dismissed } = req.body as {
      accepted?: Array<{ proposal: ServiceAreaProposal; is_published: boolean }>;
      modified?: Array<{ proposal: ServiceAreaProposal; is_published: boolean }>;
      dismissed?: string[];
    };
    
    // Get contractor profile
    const profile = await db.query.ccContractorProfiles.findFirst({
      where: and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      )
    });
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    // Combine accepted and modified proposals for confirmation
    const toConfirm = [
      ...(accepted || []),
      ...(modified || [])
    ];
    
    let savedIds: string[] = [];
    if (toConfirm.length > 0) {
      savedIds = await confirmServiceAreas(profile.id, toConfirm);
    }
    
    return res.json({
      success: true,
      saved_area_ids: savedIds,
      accepted_count: (accepted || []).length,
      modified_count: (modified || []).length,
      dismissed_count: (dismissed || []).length,
      message: 'Service areas updated successfully'
    });
  } catch (error) {
    console.error('[CONTRACTOR SERVICE AREAS] Error confirming areas:', error);
    return res.status(500).json({ success: false, error: 'Failed to confirm service areas' });
  }
});

/**
 * POST /api/contractor/profile/service-areas/dismiss
 * Dismiss all service area proposals without saving
 */
router.post('/profile/service-areas/dismiss', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    return res.json({
      success: true,
      message: 'Service area setup skipped. You can set this up later in settings.'
    });
  } catch (error) {
    console.error('[CONTRACTOR SERVICE AREAS] Error dismissing areas:', error);
    return res.status(500).json({ success: false, error: 'Failed to dismiss service areas' });
  }
});

/**
 * GET /api/contractor/profile/service-areas
 * Get all confirmed service areas for the contractor
 */
router.get('/profile/service-areas', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const portalId = req.headers['x-portal-id'] as string;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    // Get contractor profile
    const profile = await db.query.ccContractorProfiles.findFirst({
      where: and(
        eq(ccContractorProfiles.userId, userId),
        eq(ccContractorProfiles.portalId, portalId)
      )
    });
    
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Contractor profile not found' });
    }
    
    const areas = await getContractorServiceAreas(profile.id);
    
    return res.json({
      success: true,
      service_areas: areas
    });
  } catch (error) {
    console.error('[CONTRACTOR SERVICE AREAS] Error fetching areas:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch service areas' });
  }
});

/**
 * PATCH /api/contractor/profile/service-areas/:id/publish
 * Update publish state for a service area
 */
router.patch('/profile/service-areas/:id/publish', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    const { is_published } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    await updateServiceAreaPublishState(id, is_published);
    
    return res.json({
      success: true,
      message: is_published 
        ? 'Service area is now visible to the community'
        : 'Service area is now private'
    });
  } catch (error) {
    console.error('[CONTRACTOR SERVICE AREAS] Error updating publish state:', error);
    return res.status(500).json({ success: false, error: 'Failed to update publish state' });
  }
});

/**
 * DELETE /api/contractor/profile/service-areas/:id
 * Deactivate (soft delete) a service area
 */
router.delete('/profile/service-areas/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    
    await deactivateServiceArea(id);
    
    return res.json({
      success: true,
      message: 'Service area removed'
    });
  } catch (error) {
    console.error('[CONTRACTOR SERVICE AREAS] Error deactivating area:', error);
    return res.status(500).json({ success: false, error: 'Failed to remove service area' });
  }
});

export default router;
