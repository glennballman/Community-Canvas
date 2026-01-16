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

const router = Router();

// Middleware to extract and validate tenant ID from authenticated user
// Security: tenant ID must come from user's JWT claims or verified session,
// NOT from headers that could be spoofed
function requireTenantContext(req: AuthRequest, res: Response, next: NextFunction) {
  // Get tenant from user's JWT claims (set during authentication)
  // The JWT should contain tenantId for tenant-scoped users
  const user = req.user as any;
  
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  // Check for tenant ID in verified user context:
  // 1. tenantId directly in JWT claims
  // 2. From session/context set by prior middleware
  const tenantId = user.tenantId || (req as any).tenantId;
  
  if (!tenantId) {
    // Platform admins querying for a specific tenant can pass it as a query param
    // This is acceptable since platform admins have access to all tenants
    if (user.isPlatformAdmin && req.query.tenantId) {
      (req as any).tenantId = req.query.tenantId as string;
      return next();
    }
    return res.status(400).json({ error: "Tenant context required. User must belong to a tenant." });
  }
  
  (req as any).tenantId = tenantId;
  next();
}

// Middleware to require platform admin
function requirePlatformAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.isPlatformAdmin) {
    return res.status(403).json({ error: "Platform admin access required" });
  }
  next();
}

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

router.post("/assign-plan", authenticateToken, requirePlatformAdmin, async (req: AuthRequest, res: Response) => {
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
