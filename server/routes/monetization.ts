/**
 * P2.15 Monetization API Routes
 * 
 * Endpoints for:
 * - Viewing current plan and usage
 * - Assigning plans to tenants (admin only)
 * - Checking feature/event gates
 * 
 * Security:
 * - Tenant-scoped routes require authentication
 * - Plan assignment requires platform admin role
 */

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import monetization from "../lib/monetization/gating";
import type { MonetizationEventType } from "../lib/monetization/gating";
import { authenticateToken, optionalAuth, AuthRequest } from "../middleware/auth";
import { can, requireCapability } from "../auth/authorize";

const router = Router();

// PROMPT-4: Capability-based tenant context check
// Uses platform.configure capability instead of isPlatformAdmin boolean for cross-tenant access
async function requireTenantContext(req: AuthRequest, res: Response, next: NextFunction) {
  const user = req.user as any;
  
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const tenantId = user.tenantId || (req as any).tenantId;
  
  if (!tenantId) {
    // PROMPT-4: Check platform.configure capability instead of isPlatformAdmin
    const hasCapability = await can(req as any, 'platform.configure');
    if (hasCapability && req.query.tenantId) {
      (req as any).tenantId = req.query.tenantId as string;
      return next();
    }
    return res.status(400).json({ error: "Tenant context required. User must belong to a tenant." });
  }
  
  (req as any).tenantId = tenantId;
  next();
}

// PROMPT-4: Replace isPlatformAdmin check with requireCapability middleware
// This middleware is exported for use but the actual check is now capability-based
const requirePlatformAdminCapability = requireCapability('platform.configure');

// Valid event types for validation
const VALID_EVENT_TYPES = [
  'emergency_run_started',
  'emergency_playbook_exported',
  'evidence_bundle_sealed',
  'insurance_dossier_assembled',
  'insurance_dossier_exported',
  'defense_pack_assembled',
  'defense_pack_exported',
  'authority_share_issued',
  'interest_group_triggered',
  'record_capture_created',
  'offline_sync_batch'
] as const;

// Get current tenant's plan and usage (requires auth)
router.get("/usage", authenticateToken, requireTenantContext, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string;
    
    const usage = await monetization.getUsageSummary(tenantId);
    
    if (!usage) {
      return res.status(404).json({ error: "No plan found for tenant" });
    }
    
    return res.json(usage);
  } catch (error) {
    console.error("[Monetization] Error getting usage:", error);
    return res.status(500).json({ error: "Failed to get usage" });
  }
});

// Get current tenant's plan (requires auth)
router.get("/plan", authenticateToken, requireTenantContext, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string;
    
    const plan = await monetization.getTenantPlan(tenantId);
    
    if (!plan) {
      return res.status(404).json({ error: "No plan found for tenant" });
    }
    
    return res.json(plan);
  } catch (error) {
    console.error("[Monetization] Error getting plan:", error);
    return res.status(500).json({ error: "Failed to get plan" });
  }
});

// Get all available plans (public endpoint - allows seeing options before signup)
router.get("/plans", optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string | undefined;
    
    const plans = await monetization.getAvailablePlans(tenantId);
    
    return res.json({ plans });
  } catch (error) {
    console.error("[Monetization] Error getting plans:", error);
    return res.status(500).json({ error: "Failed to get plans" });
  }
});

// Check if an event is allowed (requires auth)
const checkEventSchema = z.object({
  eventType: z.enum(VALID_EVENT_TYPES),
  quantity: z.number().int().positive().optional().default(1),
});

router.post("/check-event", authenticateToken, requireTenantContext, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string;
    
    const body = checkEventSchema.parse(req.body);
    
    const result = await monetization.checkGate(
      tenantId,
      body.eventType as MonetizationEventType,
      body.quantity
    );
    
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("[Monetization] Error checking event:", error);
    return res.status(500).json({ error: "Failed to check event" });
  }
});

// Check if a feature is enabled (requires auth)
const checkFeatureSchema = z.object({
  featureKey: z.string(),
});

router.post("/check-feature", authenticateToken, requireTenantContext, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = (req as any).tenantId as string;
    
    const body = checkFeatureSchema.parse(req.body);
    
    const result = await monetization.checkFeature(tenantId, body.featureKey);
    
    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    console.error("[Monetization] Error checking feature:", error);
    return res.status(500).json({ error: "Failed to check feature" });
  }
});

// Assign a plan to a tenant (platform admin only)
const assignPlanSchema = z.object({
  tenantId: z.string().uuid(),
  planKey: z.string(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().optional(),
});

// PROMPT-4: Use capability-based middleware instead of legacy requirePlatformAdmin
router.post("/assign-plan", authenticateToken, requirePlatformAdminCapability, async (req: AuthRequest, res: Response) => {
  try {
    const body = assignPlanSchema.parse(req.body);
    
    const result = await monetization.assignPlan(
      body.tenantId,
      body.planKey,
      req.user?.id,
      body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
      body.effectiveTo ? new Date(body.effectiveTo) : undefined
    );
    
    return res.json({
      success: true,
      assignmentId: result.assignmentId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: error.errors });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    console.error("[Monetization] Error assigning plan:", error);
    return res.status(500).json({ error: "Failed to assign plan" });
  }
});

export default router;
