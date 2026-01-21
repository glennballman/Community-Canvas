/**
 * Contractor Routes - Prompt A1: Contractor Onboarding Entry Point
 * 
 * Routes for contractor profile management and onboarding state tracking.
 * Camera-first onboarding experience with no forms required.
 */

import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { ccContractorProfiles } from '@shared/schema';
import { authenticateToken } from '../middleware/auth';

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
    
    // Auto-create profile if doesn't exist
    if (!profile) {
      const [newProfile] = await db.insert(ccContractorProfiles).values({
        userId,
        portalId,
        tenantId: tenantId || null,
        onboardingComplete: false,
        onboardingStartedAt: new Date(),
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
      
      console.log(`[CONTRACTOR] Onboarding started for user ${userId} in portal ${portalId}`);
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
      message: 'Contractor onboarding started.'
    });
  } catch (error) {
    console.error('[CONTRACTOR] Error starting onboarding:', error);
    return res.status(500).json({ success: false, error: 'Failed to start onboarding' });
  }
});

export default router;
