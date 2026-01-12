import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { pool } from "./db";
import { api } from "@shared/routes";
import { z } from "zod";
import { getFirecrawlApp } from './lib/firecrawl';
import fs from "fs";
import path from "path";
import { runChamberAudit } from "@shared/chamber-audit";
import { buildNAICSTree, getMembersByNAICSCode, getMembersBySector, getMembersBySubsector } from "@shared/naics-hierarchy";
import { BC_CHAMBERS_OF_COMMERCE } from "@shared/chambers-of-commerce";
import { chamberMembers as staticMembers } from "@shared/chamber-members";
import { getJsonLoadedMembers } from "@shared/chamber-member-registry";
import { getChamberProgressList, getChamberProgressSummary } from "@shared/chamber-progress";
import { createFleetRouter } from "./routes/fleet";
import { createAccommodationsRouter } from "./routes/accommodations";
import stagingRouter from "./routes/staging";
import hostAuthRouter from "./routes/hostAuth";
import hostPropertiesRouter from "./routes/hostProperties";
import authRouter from "./routes/auth";
import hostDashboardRouter from "./routes/host";
import importRouter from "./routes/import";
import civosRouter from "./routes/civos";
import foundationRouter from "./routes/foundation";
import vehiclesRouter from "./routes/vehicles";
import serviceRunsRouter from "./routes/serviceRuns";
import individualsRouter from "./routes/individuals";
import rentalsRouter from "./routes/rentals";
import entitiesRouter from "./routes/entities";
import apifyRouter from "./routes/apify";
import { JobberService, getJobberAuthUrl, exchangeCodeForToken } from "./services/jobber";
import { CompanyCamService, getPhotoUrl } from "./services/companycam";
import { createCrewRouter } from "./routes/crew";
import claimsRouter from "./routes/claims";
import internalRouter from "./routes/internal";
import workRequestsRouter from "./routes/work-requests";
import procurementRequestsRouter from "./routes/procurement-requests";
import projectsRouter from "./routes/projects";
import bidsRouter from "./routes/bids";
import uploadsRouter from "./routes/uploads";
import toolsRouter from "./routes/tools";
import conversationsRouter from "./routes/conversations";
import feedbackRouter from "./routes/feedback";
import seriousIssuesRouter from "./routes/serious-issues";
import appreciationsRouter from "./routes/appreciations";
import financingRouter from "./routes/financing";
import paymentsRouter from "./routes/payments";
import trustSignalsRouter from "./routes/trust-signals";
import sharedRunsRouter from "./routes/shared-runs";
import operatorRouter from "./routes/operator";
import publicPortalRouter from "./routes/public-portal";
import userContextRouter from "./routes/user-context";
import adminImpersonationRouter from "./routes/admin-impersonation";
import adminTenantsRouter from "./routes/admin-tenants";
import adminCommunitiesRouter from "./routes/admin-communities";
import adminModerationRouter from "./routes/admin-moderation";
import adminInventoryRouter from "./routes/admin-inventory";
import crmRouter from "./routes/crm";
import scheduleRouter from "./routes/schedule";
import capacityConstraintsRouter from "./routes/capacityConstraints";
import qaSeedRouter from "./routes/qa-seed";
import systemExplorerRouter from "./routes/system-explorer";
import sitemapRouter from "./routes/sitemap";
import mediaRouter from "./routes/media";
import communityRouter from "./routes/community";
import { publicQuery, serviceQuery } from "./db/tenantDb";
import express from "express";

// Merge static members with JSON-loaded members for consistent data across the app
// IMPORTANT: This function is called per-request to ensure fresh data after JSON file updates
function getAllChamberMembers() {
  const jsonMembers = getJsonLoadedMembers();
  const jsonMemberIds = new Set(jsonMembers.map(m => m.id));
  const uniqueStaticMembers = staticMembers.filter(m => !jsonMemberIds.has(m.id));
  return [...uniqueStaticMembers, ...jsonMembers];
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {


  // SECURITY NOTE: Platform staff session isolation is enforced via cookie path restriction
  // The platform_sid cookie has path=/api/internal, so it's ONLY sent to /api/internal routes
  // This means platform staff sessions are invisible on tenant routes by design:
  // - Public endpoints are accessible by anyone (expected behavior)
  // - Tenant-protected endpoints require tenant_sid which platform staff don't have
  // - Platform staff must use impersonation system to access tenant data on /api/internal routes

  // Register sitemap routes (at root level for SEO)
  app.use('/', sitemapRouter);

  // Register fleet management routes
  app.use('/api/v1/fleet', createFleetRouter(pool));

  // Register accommodations routes
  app.use('/api/accommodations', createAccommodationsRouter(pool));

  // Register staging network routes
  app.use('/api/staging', stagingRouter);

  // Register host authentication routes
  app.use('/api/host/auth', hostAuthRouter);

  // Register host property management routes
  app.use('/api/host', hostPropertiesRouter);

  // Register user authentication routes
  app.use('/api/auth', authRouter);

  // Register host dashboard routes (JWT auth)
  app.use('/api/host-dashboard', hostDashboardRouter);

  // Register data import routes (JWT auth)
  app.use('/api/import', importRouter);

  // Register CivOS integration routes
  app.use('/api/civos', civosRouter);

  // Register multi-tenant foundation routes
  app.use('/api/foundation', foundationRouter);

  // Register vehicles/trailers/fleets routes
  app.use('/api/vehicles', vehiclesRouter);

  // Set pool on app for routes that need it
  app.set('db', pool);

  // Register Service Runs API routes
  app.use('/api/service-runs', serviceRunsRouter);

  // Register Individuals profile routes
  app.use('/api/individuals', individualsRouter);

  // Register Rentals browser routes
  app.use('/api/rentals', rentalsRouter);

  // Register external data lake + entity resolution routes
  app.use('/api/cc_entities', entitiesRouter);

  // Register Apify sync and external records routes
  app.use('/api/apify', apifyRouter);

  // Register crew accommodation search routes
  app.use('/api/crew', createCrewRouter());

  // Register inventory claims routes
  app.use('/api/v1/inventory/claims', claimsRouter);

  // Register internal platform review console routes
  // SECURITY: CORS disabled, rate-limited, requires platform staff auth
  // These routes are NOT accessible by tenant users or service-key
  app.use('/api/internal', internalRouter);

  // Register intake work requests (new system - quick capture inbox)
  app.use('/api/work-requests', workRequestsRouter);
  
  // Register procurement requests (former "opportunities" - RFP/bidding system)
  app.use('/api/procurement-requests', procurementRequestsRouter);
  // TODO: Remove /api/opportunities alias after launch stabilization
  app.use('/api/opportunities', procurementRequestsRouter);
  app.use('/api/cc_bids', bidsRouter);

  // Register cc_projects routes (job tracking from lead to paid)
  app.use('/api/cc_projects', projectsRouter);

  // Register file uploads and serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  app.use('/api/uploads', uploadsRouter);

  // Register tenant tools inventory routes
  app.use('/api/tools', toolsRouter);

  // Register cc_conversations/messaging routes
  app.use('/api', conversationsRouter);

  // Register private feedback routes (small-town trust model)
  app.use('/api', feedbackRouter);

  // Register public appreciations routes (positive-only, opt-in)
  app.use('/api', appreciationsRouter);

  // Register serious issues routes (admin-only internal reporting)
  app.use('/api', seriousIssuesRouter);

  // Register contractor financing routes
  app.use('/api', financingRouter);

  // Register payment promises routes (honor system)
  app.use('/api', paymentsRouter);

  // Register trust signals + feedback routes (small-town trust model)
  app.use('/api', trustSignalsRouter);

  // Register Shared Service Runs routes (bundling, NOT bidding)
  app.use('/api/shared-runs', sharedRunsRouter);

  // Register community routes (cross-tenant Chamber operations)
  app.use('/api/community', communityRouter);

  // Register CRM routes (Places, People, Organizations)
  app.use('/api/crm', crmRouter);

  // Register schedule/operations board routes (15-minute precision)
  // Mount at both paths for client compatibility
  app.use('/api/schedule', scheduleRouter);
  app.use('/api/v1/schedule', scheduleRouter);
  
  // Register capacity/constraints management routes
  app.use('/api/capacity', capacityConstraintsRouter);
  
  // Register cc_media storage routes
  app.use('/api/cc_media', mediaRouter);

  // Register QA seed/test routes (dev only)
  if (process.env.NODE_ENV === 'development') {
    app.use('/api', qaSeedRouter);
  }

  // Register operator routes (for community operators)
  app.use('/api/operator', operatorRouter);

  // Register public portal routes (no auth required)
  // Mount at both standard path and /b/:slug dev path for portal resolution
  app.use('/api/public', publicPortalRouter);
  app.use('/b/:portalSlug/api/public', publicPortalRouter);

  // Register user context routes (auth required)
  app.use('/api', userContextRouter);

  // Register admin impersonation routes (platform admin only)
  app.use('/api/admin/impersonation', adminImpersonationRouter);

  // Register admin tenants routes (platform admin only)
  app.use('/api/admin/tenants', adminTenantsRouter);

  // Register admin communities routes (platform admin only)
  app.use('/api/admin/communities', adminCommunitiesRouter);

  // Register admin moderation routes (platform admin only)
  app.use('/api/admin/moderation', adminModerationRouter);

  // Register admin inventory routes (platform admin only)
  app.use('/api/admin/inventory', adminInventoryRouter);
  
  // Register system explorer routes (debug/discovery surface)
  app.use('/api/admin/system-explorer', systemExplorerRouter);

  // Admin cc_articles endpoint (platform admin only) - renamed from presentations for schema.org compliance
  app.get('/api/admin/presentations', (req, res) => res.redirect('/api/admin/cc_articles'));
  app.get('/api/admin/cc_articles', async (req, res) => {
    try {
      // First get presentations with portal info
      const presentationsResult = await serviceQuery(`
        SELECT 
          ep.id,
          ep.slug,
          ep.title,
          ep.subtitle,
          ep.entity_type,
          ep.presentation_type,
          ep.status,
          ep.visibility,
          ep.tags,
          ep.created_at,
          p.id as portal_id,
          p.slug as portal_slug,
          p.name as portal_name
        FROM cc_articles ep
        JOIN cc_portals p ON p.id = ep.portal_id
        ORDER BY p.name, ep.created_at DESC
      `);
      
      // Get blocks for each presentation
      const blocksResult = await serviceQuery(`
        SELECT 
          pb.presentation_id,
          pb.block_type,
          pb.block_order
        FROM cc_presentation_blocks pb
        ORDER BY pb.presentation_id, pb.block_order
      `);
      
      // Group blocks by presentation
      const blocksByPresentation = new Map<string, { block_type: string }[]>();
      for (const block of blocksResult.rows) {
        if (!blocksByPresentation.has(block.presentation_id)) {
          blocksByPresentation.set(block.presentation_id, []);
        }
        blocksByPresentation.get(block.presentation_id)!.push({ block_type: block.block_type });
      }
      
      // Group presentations by portal
      const portalMap = new Map<string, {
        portal_slug: string;
        portal_name: string;
        presentations: any[];
      }>();
      
      for (const row of presentationsResult.rows) {
        if (!portalMap.has(row.portal_slug)) {
          portalMap.set(row.portal_slug, {
            portal_slug: row.portal_slug,
            portal_name: row.portal_name,
            presentations: []
          });
        }
        portalMap.get(row.portal_slug)!.presentations.push({
          id: row.id,
          slug: row.slug,
          title: row.title,
          subtitle: row.subtitle,
          entity_type: row.entity_type,
          presentation_type: row.presentation_type,
          status: row.status,
          visibility: row.visibility,
          tags: row.tags,
          created_at: row.created_at,
          blocks: blocksByPresentation.get(row.id) || [],
          portal: { id: row.portal_id, name: row.portal_name, slug: row.portal_slug }
        });
      }
      
      res.json({ 
        success: true, 
        data: Array.from(portalMap.values())
      });
    } catch (error) {
      console.error('Admin presentations error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch presentations' });
    }
  });

  // Public inventory endpoints (no auth required)
  app.get('/api/v1/inventory/vehicles', async (req, res) => {
    try {
      const { q, make, model, year_min, year_max, has_listings, limit = '50', offset = '0' } = req.query;
      
      let query = `
        SELECT 
          vc.id as vehicle_inventory_id,
          vc.make,
          vc.model,
          vc.year,
          vc.vehicle_class,
          COALESCE(
            (SELECT json_agg(json_build_object('id', cm.id, 'url', cm.url))
             FROM inventory_media cm 
             WHERE cm.vehicle_inventory_id = vc.id),
            '[]'::json
          ) as cc_media,
          (SELECT COUNT(*) FROM inventory_listings cl WHERE cl.vehicle_inventory_id = vc.id)::int as listings_count
        FROM vehicle_inventory vc
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (q) {
        paramCount++;
        query += ` AND (vc.make ILIKE $${paramCount} OR vc.model ILIKE $${paramCount})`;
        params.push(`%${q}%`);
      }
      if (make) {
        paramCount++;
        query += ` AND vc.make ILIKE $${paramCount}`;
        params.push(`%${make}%`);
      }
      if (model) {
        paramCount++;
        query += ` AND vc.model ILIKE $${paramCount}`;
        params.push(`%${model}%`);
      }
      if (year_min) {
        paramCount++;
        query += ` AND vc.year >= $${paramCount}`;
        params.push(parseInt(year_min as string));
      }
      if (year_max) {
        paramCount++;
        query += ` AND vc.year <= $${paramCount}`;
        params.push(parseInt(year_max as string));
      }
      if (has_listings === 'true') {
        query += ` AND EXISTS (SELECT 1 FROM inventory_listings cl WHERE cl.vehicle_inventory_id = vc.id)`;
      }

      query += ` ORDER BY vc.make, vc.model, vc.year DESC`;
      
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(parseInt(limit as string));
      
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(parseInt(offset as string));

      const result = await publicQuery(query, params);
      res.json({ items: result.rows });
    } catch (e: any) {
      console.error('Inventory vehicles error:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get('/api/v1/inventory/trailers', async (req, res) => {
    try {
      const { q, make, model, year_min, year_max, has_listings, limit = '50', offset = '0' } = req.query;
      
      let query = `
        SELECT 
          tc.id as trailer_inventory_id,
          tc.make,
          tc.model,
          tc.year,
          tc.trailer_type,
          COALESCE(
            (SELECT json_agg(json_build_object('id', cm.id, 'url', cm.url))
             FROM inventory_media cm 
             WHERE cm.trailer_inventory_id = tc.id),
            '[]'::json
          ) as cc_media,
          (SELECT COUNT(*) FROM inventory_listings cl WHERE cl.trailer_inventory_id = tc.id)::int as listings_count
        FROM trailer_inventory tc
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramCount = 0;

      if (q) {
        paramCount++;
        query += ` AND (tc.make ILIKE $${paramCount} OR tc.model ILIKE $${paramCount})`;
        params.push(`%${q}%`);
      }
      if (make) {
        paramCount++;
        query += ` AND tc.make ILIKE $${paramCount}`;
        params.push(`%${make}%`);
      }
      if (model) {
        paramCount++;
        query += ` AND tc.model ILIKE $${paramCount}`;
        params.push(`%${model}%`);
      }
      if (year_min) {
        paramCount++;
        query += ` AND tc.year >= $${paramCount}`;
        params.push(parseInt(year_min as string));
      }
      if (year_max) {
        paramCount++;
        query += ` AND tc.year <= $${paramCount}`;
        params.push(parseInt(year_max as string));
      }
      if (has_listings === 'true') {
        query += ` AND EXISTS (SELECT 1 FROM inventory_listings cl WHERE cl.trailer_inventory_id = tc.id)`;
      }

      query += ` ORDER BY tc.make, tc.model, tc.year DESC`;
      
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      params.push(parseInt(limit as string));
      
      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(parseInt(offset as string));

      const result = await publicQuery(query, params);
      res.json({ items: result.rows });
    } catch (e: any) {
      console.error('Inventory trailers error:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Debug endpoint: Happy-path RLS test with tenant context
  app.get('/api/_debug/rls-happy-path', async (req, res) => {
    const results: any = { steps: [] };
    let tenantId: string | null = null;
    let individualId: string | null = null;
    let vehicleId: string | null = null;
    let assetId: string | null = null;
    
    try {
      const { withServiceTransaction } = await import('./db/tenantDb');
      
      // Step 1: Seed test tenant and individual in SERVICE transaction
      const seedResult = await withServiceTransaction(async (client) => {
        // Insert test tenant (using actual schema columns)
        const tenantRes = await client.query(`
          INSERT INTO cc_tenants (id, name, slug, tenant_type, status)
          VALUES (gen_random_uuid(), 'RLS Test Tenant', 'rls-test-' || extract(epoch from now())::int, 'business', 'active')
          RETURNING id
        `);
        const tid = tenantRes.rows[0].id;
        
        // Insert test individual (using actual schema columns)
        const indRes = await client.query(`
          INSERT INTO cc_individuals (id, full_name, email, status)
          VALUES (gen_random_uuid(), 'RLS Tester', 'rls-test-' || extract(epoch from now())::int || '@test.local', 'active')
          RETURNING id
        `);
        const iid = indRes.rows[0].id;
        
        return { tenant_id: tid, individual_id: iid };
      });
      
      tenantId = seedResult.tenant_id;
      individualId = seedResult.individual_id;
      results.steps.push({
        step: 1,
        description: 'Seed test tenant + individual via withServiceTransaction',
        tenant_id: tenantId,
        individual_id: individualId,
        status: 'SUCCESS'
      });
      
      // Step 2 & 3: Simulate authenticated request with tenant context (COMMITTED transaction)
      const insertResult = await withServiceTransaction(async (client) => {
        // Set tenant context (simulating tenantTransaction with ctx)
        await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
        await client.query(`SELECT set_config('app.individual_id', $1, true)`, [individualId]);
        
        // Insert tenant_vehicle
        const insertRes = await client.query(`
          INSERT INTO cc_tenant_vehicles (id, tenant_id, nickname, is_active, status)
          VALUES (gen_random_uuid(), $1, 'RLS Happy Path Vehicle', true, 'active')
          RETURNING id, asset_id
        `, [tenantId]);
        
        const vid = insertRes.rows[0].id;
        const aid = insertRes.rows[0].asset_id;
        
        // Verify asset record in same transaction
        const assetRes = await client.query(`
          SELECT tenant_id, owner_tenant_id, source_table, source_id 
          FROM cc_assets WHERE id = $1
        `, [aid]);
        
        // Check cc_asset_capabilities
        const capRes = await client.query(`
          SELECT COUNT(*) as count FROM cc_asset_capabilities WHERE asset_id = $1
        `, [aid]);
        
        return {
          vehicle_id: vid,
          asset_id: aid,
          asset_record: assetRes.rows[0],
          capability_count: parseInt(capRes.rows[0].count)
        };
      });
      
      vehicleId = insertResult.vehicle_id;
      assetId = insertResult.asset_id;
      
      results.steps.push({
        step: 2,
        description: 'Set tenant context via set_config',
        context: { tenant_id: tenantId, individual_id: individualId },
        status: 'SUCCESS'
      });
      
      results.steps.push({
        step: 3,
        description: 'INSERT tenant_vehicle with tenant context (COMMITTED)',
        vehicle_id: vehicleId,
        asset_id: assetId,
        asset_id_is_not_null: assetId !== null,
        status: assetId !== null ? 'SUCCESS' : 'FAILED - asset_id is null'
      });
      
      if (assetId === null) {
        throw new Error('FAIL: asset_id is null after INSERT');
      }
      
      const assetVerification = {
        tenant_id_matches: insertResult.asset_record?.tenant_id === tenantId,
        owner_tenant_id_matches: insertResult.asset_record?.owner_tenant_id === tenantId,
        source_table_correct: insertResult.asset_record?.source_table === 'cc_tenant_vehicles',
        source_id_matches: insertResult.asset_record?.source_id === vehicleId
      };
      
      results.steps.push({
        step: '4a',
        description: 'Verify asset record matches expected values',
        asset_record: insertResult.asset_record,
        verification: assetVerification,
        status: Object.values(assetVerification).every(v => v) ? 'SUCCESS' : 'FAILED'
      });
      
      if (!Object.values(assetVerification).every(v => v)) {
        throw new Error('FAIL: asset verification failed');
      }
      
      results.steps.push({
        step: '4b',
        description: 'Query cc_asset_capabilities (must not error)',
        capability_count: insertResult.capability_count,
        status: 'SUCCESS'
      });
      
      // Step 5: Cleanup in service transaction with fail-fast
      const cleanupResult = await withServiceTransaction(async (client) => {
        const deleted: any = { errors: [] };
        
        // Delete in correct order for FK constraints:
        // a) Delete cc_tenant_vehicle_photos first
        if (vehicleId) {
          const photosRes = await client.query('DELETE FROM cc_tenant_vehicle_photos WHERE tenant_vehicle_id = $1', [vehicleId]);
          deleted.vehicle_photos = photosRes.rowCount;
        }
        
        // b) Delete cc_tenant_vehicles
        if (vehicleId) {
          const vRes = await client.query('DELETE FROM cc_tenant_vehicles WHERE id = $1 RETURNING id', [vehicleId]);
          deleted.vehicle = vRes.rowCount;
          if (vRes.rowCount !== 1) {
            deleted.errors.push(`Expected vehicle delete rowCount=1, got ${vRes.rowCount}`);
          }
        }
        
        // c) Delete cc_asset_capabilities
        if (assetId) {
          const capRes = await client.query('DELETE FROM cc_asset_capabilities WHERE asset_id = $1', [assetId]);
          deleted.cc_asset_capabilities = capRes.rowCount;
        }
        
        // d) Delete assets
        if (assetId) {
          const aRes = await client.query('DELETE FROM cc_assets WHERE id = $1 RETURNING id', [assetId]);
          deleted.asset = aRes.rowCount;
          if (aRes.rowCount !== 1) {
            deleted.errors.push(`Expected asset delete rowCount=1, got ${aRes.rowCount}`);
          }
        }
        
        // Delete individual
        if (individualId) {
          const iRes = await client.query('DELETE FROM cc_individuals WHERE id = $1 RETURNING id', [individualId]);
          deleted.individual = iRes.rowCount;
          if (iRes.rowCount !== 1) {
            deleted.errors.push(`Expected individual delete rowCount=1, got ${iRes.rowCount}`);
          }
        }
        
        // Delete tenant
        if (tenantId) {
          const tRes = await client.query('DELETE FROM cc_tenants WHERE id = $1 RETURNING id', [tenantId]);
          deleted.tenant = tRes.rowCount;
          if (tRes.rowCount !== 1) {
            deleted.errors.push(`Expected tenant delete rowCount=1, got ${tRes.rowCount}`);
          }
        }
        
        return deleted;
      });
      
      const cleanupSuccess = cleanupResult.errors.length === 0;
      results.steps.push({
        step: 5,
        description: 'Cleanup via withServiceTransaction',
        deleted: cleanupResult,
        status: cleanupSuccess ? 'SUCCESS' : 'FAILED'
      });
      
      if (!cleanupSuccess) {
        results.overall = 'FAILED - cleanup errors';
        res.status(500).json(results);
        return;
      }
      
      results.overall = 'ALL STEPS PASSED';
      res.json(results);
      
    } catch (e: any) {
      results.error = e.message;
      results.stack = e.stack;
      
      // Attempt cleanup on error
      if (tenantId || individualId) {
        try {
          const { withServiceTransaction } = await import('./db/tenantDb');
          await withServiceTransaction(async (client) => {
            if (vehicleId) await client.query('DELETE FROM cc_tenant_vehicles WHERE id = $1', [vehicleId]);
            if (assetId) await client.query('DELETE FROM cc_assets WHERE id = $1', [assetId]);
            if (individualId) await client.query('DELETE FROM cc_individuals WHERE id = $1', [individualId]);
            if (tenantId) await client.query('DELETE FROM cc_tenants WHERE id = $1', [tenantId]);
          });
          results.cleanup = 'attempted';
        } catch (cleanupErr: any) {
          results.cleanup_error = cleanupErr.message;
        }
      }
      
      res.status(500).json(results);
    }
  });

  // Debug endpoint to prove db connection runs as cc_app with RLS
  app.get('/api/_debug/db-whoami', async (req, res) => {
    try {
      const client = await pool.connect();
      try {
        // Get current user info
        const userResult = await client.query('SELECT current_user, session_user');
        
        // Get role info
        const roleResult = await client.query(`
          SELECT rolname, rolsuper, rolbypassrls, rolcanlogin
          FROM pg_roles
          WHERE rolname = current_user
        `);
        
        // Test RLS enforcement - clear context first
        await client.query(`SELECT set_config('app.tenant_id', '', true)`);
        await client.query(`SELECT set_config('app.portal_id', '', true)`);
        await client.query(`SELECT set_config('app.individual_id', '', true)`);
        
        // Count should be 0 with no tenant context
        const countResult = await client.query('SELECT COUNT(*) as count FROM cc_tenant_vehicles');
        
        // Try insert - should fail
        let insertError = null;
        try {
          await client.query(`
            INSERT INTO cc_tenant_vehicles (tenant_id, nickname, is_active, status)
            VALUES (gen_random_uuid(), 'should_fail', true, 'active')
          `);
        } catch (e: any) {
          insertError = e.message;
        }
        
        // Test with tenant context - use first available tenant
        const tenantResult = await client.query('SELECT id FROM cc_tenants LIMIT 1');
        let countWithContext = null;
        let tenantId = null;
        if (tenantResult.rows.length > 0) {
          tenantId = tenantResult.rows[0].id;
          await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
          const countWithContextResult = await client.query('SELECT COUNT(*) as count FROM cc_tenant_vehicles');
          countWithContext = parseInt(countWithContextResult.rows[0].count);
          // Clear context again
          await client.query(`SELECT set_config('app.tenant_id', '', true)`);
        }
        
        res.json({
          current_user: userResult.rows[0].current_user,
          session_user: userResult.rows[0].session_user,
          role_info: roleResult.rows[0],
          rls_test: {
            without_context: {
              count: parseInt(countResult.rows[0].count),
              insert_blocked: insertError ? true : false,
              insert_error: insertError
            },
            with_tenant_context: tenantId ? {
              tenant_id: tenantId,
              count: countWithContext
            } : 'no tenants found'
          }
        });
      } finally {
        client.release();
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Jobber OAuth flow - Start authorization
  app.get('/api/v1/integrations/jobber/auth', (req, res) => {
    const clientId = process.env.JOBBER_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'JOBBER_CLIENT_ID not configured' });
    }
    
    const host = req.headers.host || 'localhost:5000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/api/v1/integrations/jobber/callback`;
    
    const authUrl = getJobberAuthUrl({
      clientId,
      clientSecret: '',
      redirectUri,
    });
    
    res.redirect(authUrl);
  });

  // Jobber OAuth callback - Exchange code for token
  app.get('/api/v1/integrations/jobber/callback', async (req, res) => {
    try {
      const { code, error } = req.query;
      
      if (error) {
        return res.status(400).send(`
          <html>
            <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
              <h1>Authorization Failed</h1>
              <p>Error: ${error}</p>
              <a href="/">Return to app</a>
            </body>
          </html>
        `);
      }
      
      if (!code) {
        return res.status(400).json({ error: 'No authorization code received' });
      }

      const clientId = process.env.JOBBER_CLIENT_ID;
      const clientSecret = process.env.JOBBER_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'Jobber credentials not configured' });
      }

      const host = req.headers.host || 'localhost:5000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const redirectUri = `${protocol}://${host}/api/v1/integrations/jobber/callback`;

      const tokens = await exchangeCodeForToken(code as string, {
        clientId,
        clientSecret,
        redirectUri,
      });

      // Display the tokens to the user so they can save them
      res.send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; max-width: 800px; margin: 0 auto;">
            <h1 style="color: green;">Jobber Authorization Successful!</h1>
            <p>Copy your access token below and add it as JOBBER_ACCESS_TOKEN in your Secrets:</p>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <label style="font-weight: bold; display: block; margin-bottom: 8px;">Access Token:</label>
              <textarea readonly style="width: 100%; height: 80px; font-family: monospace; font-size: 12px;">${tokens.access_token}</textarea>
            </div>
            <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <label style="font-weight: bold; display: block; margin-bottom: 8px;">Refresh Token (save this too):</label>
              <textarea readonly style="width: 100%; height: 80px; font-family: monospace; font-size: 12px;">${tokens.refresh_token}</textarea>
            </div>
            <p><strong>Token expires in:</strong> ${Math.floor(tokens.expires_in / 3600)} hours</p>
            <p>After adding the secret, <a href="/trip-timeline-demo">return to the app</a> to test the integration.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Jobber OAuth callback error:', error);
      res.status(500).send(`
        <html>
          <body style="font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto;">
            <h1>Token Exchange Failed</h1>
            <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
            <a href="/">Return to app</a>
          </body>
        </html>
      `);
    }
  });

  // Jobber connection test endpoint
  app.get('/api/v1/integrations/jobber/test', async (req, res) => {
    try {
      const accessToken = process.env.JOBBER_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ 
          connected: false,
          error: 'JOBBER_ACCESS_TOKEN not configured'
        });
      }

      const jobber = new JobberService({ accessToken });
      const result = await jobber.testConnection();
      
      res.json({
        connected: true,
        account: result,
      });
    } catch (error) {
      console.error('Jobber connection test error:', error);
      res.status(500).json({ 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Jobber integration endpoint
  app.get('/api/v1/integrations/jobber/job/:jobNumber', async (req, res) => {
    try {
      const { jobNumber } = req.params;
      
      const accessToken = process.env.JOBBER_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ 
          error: 'Jobber not configured',
          message: 'JOBBER_ACCESS_TOKEN environment variable not set'
        });
      }

      const jobber = new JobberService({ accessToken });
      const job = await jobber.getJobByNumber(jobNumber);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json(job);
    } catch (error) {
      console.error('Jobber API error:', error);
      res.status(500).json({ error: 'Failed to fetch job from Jobber' });
    }
  });

  // Jobber jobs for date range
  app.get('/api/v1/integrations/jobber/jobs', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate query parameters required' });
      }
      
      const accessToken = process.env.JOBBER_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ 
          error: 'Jobber not configured',
          message: 'JOBBER_ACCESS_TOKEN environment variable not set'
        });
      }

      const jobber = new JobberService({ accessToken });
      const jobs = await jobber.getJobsForDateRange(startDate as string, endDate as string);
      
      res.json({ jobs });
    } catch (error) {
      console.error('Jobber API error:', error);
      res.status(500).json({ error: 'Failed to fetch jobs from Jobber' });
    }
  });

  // CompanyCam integration endpoints
  app.get('/api/v1/integrations/companycam/test', async (req, res) => {
    try {
      const accessToken = process.env.COMPANYCAM_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ 
          connected: false,
          error: 'COMPANYCAM_ACCESS_TOKEN not configured'
        });
      }

      const companycam = new CompanyCamService({ accessToken });
      const result = await companycam.testConnection();
      
      res.json(result);
    } catch (error) {
      console.error('CompanyCam connection test error:', error);
      res.status(500).json({ 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/v1/integrations/companycam/project/:projectId/photos', async (req, res) => {
    try {
      const { projectId } = req.params;
      const { limit = '10' } = req.query;
      
      const accessToken = process.env.COMPANYCAM_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ error: 'CompanyCam not configured' });
      }

      const companycam = new CompanyCamService({ accessToken });
      const photos = await companycam.getProjectPhotos(projectId, 1, Number(limit));
      
      const formattedPhotos = photos.map((photo) => ({
        id: photo.id,
        url: getPhotoUrl(photo.uris, 'original') || getPhotoUrl(photo.uris, 'web'),
        thumbnailUrl: getPhotoUrl(photo.uris, 'thumbnail'),
        caption: photo.creator_name || '',
        timestamp: photo.captured_at,
        tags: photo.tags?.map((t) => t.name) || [],
        source: 'companycam',
      }));

      res.json(formattedPhotos);
    } catch (error) {
      console.error('CompanyCam API error:', error);
      res.status(500).json({ error: 'Failed to fetch photos' });
    }
  });

  app.get('/api/v1/integrations/companycam/search', async (req, res) => {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({ error: 'Search query (q) is required' });
      }
      
      const accessToken = process.env.COMPANYCAM_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ error: 'CompanyCam not configured' });
      }

      const companycam = new CompanyCamService({ accessToken });
      const cc_projects = await companycam.searchProjects(String(q));

      res.json(cc_projects);
    } catch (error) {
      console.error('CompanyCam API error:', error);
      res.status(500).json({ error: 'Failed to search cc_projects' });
    }
  });

  app.get('/api/v1/integrations/companycam/cc_projects', async (req, res) => {
    try {
      const { page = '1', limit = '50' } = req.query;
      
      const accessToken = process.env.COMPANYCAM_ACCESS_TOKEN;
      if (!accessToken) {
        return res.status(401).json({ error: 'CompanyCam not configured' });
      }

      const companycam = new CompanyCamService({ accessToken });
      const cc_projects = await companycam.getProjects(Number(page), Number(limit));

      res.json(cc_projects);
    } catch (error) {
      console.error('CompanyCam API error:', error);
      res.status(500).json({ error: 'Failed to fetch cc_projects' });
    }
  });

  app.get(api.cc_snapshots.getLatest.path, async (req, res) => {
    try {
      const { cityName } = req.params;
      const snapshot = await storage.getLatestSnapshot(cityName);
      if (!snapshot) {
        return res.status(404).json({ message: 'No snapshot found for this location' });
      }
      res.json({
        success: true,
        data: snapshot.data,
        timestamp: snapshot.createdAt?.toISOString() || new Date().toISOString()
      });
    } catch (error) {
      console.error("Fetch snapshot error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.cc_snapshots.refresh.path, async (req, res) => {
    try {
      const { location } = api.cc_snapshots.refresh.input.parse(req.body);
      const apiKey = process.env.FIRECRAWL_API_KEY;

      if (!apiKey || apiKey === 'your-api-key') {
        return res.status(400).json({ message: "Firecrawl API key not configured" });
      }

      const firecrawl = await getFirecrawlApp(apiKey);

      const prompt = `Extract real-time status updates and cc_snapshots for ${location}. 
      Structure the response into a 'categories' object where keys are standard IDs (emergency, power, water, ferry, traffic, transit, airport, weather, tides, air_quality, health, cc_events, parking, construction, economic, fire) and values are arrays of status objects.
      
      Standard Status Object:
      {
        "label": "Name of specific service/area",
        "status": "Short status string (Operational, Outage, Delay, etc)",
        "status_citation": "URL to source",
        "details": "Brief additional context",
        "severity": "info" | "warning" | "critical"
      }

      Focus on major municipal services, transit lines, and utilities. If data for a category isn't found, return an empty array for that key.`;

      const result = await firecrawl.extract([
        "https://vancouver.ca",
        "https://www.bchydro.com/outages",
        "https://drivebc.ca",
        "https://www.bcferries.com",
        "https://translink.ca"
      ], {
        prompt,
        schema: z.object({
          location: z.string(),
          categories: z.record(z.string(), z.array(z.object({
            label: z.string(),
            status: z.string(),
            status_citation: z.string().optional(),
            details: z.string().optional(),
            severity: z.enum(["info", "warning", "critical"]).optional()
          })))
        })
      });

      if (result.success && result.data) {
        await storage.createSnapshot({
          location,
          data: {
            location,
            timestamp: new Date().toISOString(),
            categories: result.data.categories as any
          }
        });
        return res.json({ success: true, message: "Data refreshed from Firecrawl" });
      } else {
        throw new Error(result.error || "Firecrawl extraction failed");
      }

    } catch (err) {
      console.error("Refresh error:", err);
      res.status(500).json({ message: "Failed to refresh data: " + (err as Error).message });
    }
  });

  app.get("/api/admin/chamber-audit", async (req, res) => {
    try {
      const auditResults = runChamberAudit();
      res.json(auditResults);
    } catch (error) {
      console.error("Chamber audit error:", error);
      res.status(500).json({ message: "Failed to run chamber audit" });
    }
  });

  app.get("/api/naics/tree", async (req, res) => {
    try {
      const tree = buildNAICSTree();
      res.json(tree);
    } catch (error) {
      console.error("NAICS tree error:", error);
      res.status(500).json({ message: "Failed to build NAICS tree" });
    }
  });

  app.get("/api/naics/sector/:sectorCode/members", async (req, res) => {
    try {
      const { sectorCode } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const result = getMembersBySector(sectorCode, page, pageSize);
      res.json(result);
    } catch (error) {
      console.error("NAICS sector members error:", error);
      res.status(500).json({ message: "Failed to get sector members" });
    }
  });

  app.get("/api/naics/subsector/:subsectorCode/members", async (req, res) => {
    try {
      const { subsectorCode } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const result = getMembersBySubsector(subsectorCode, page, pageSize);
      res.json(result);
    } catch (error) {
      console.error("NAICS subsector members error:", error);
      res.status(500).json({ message: "Failed to get subsector members" });
    }
  });

  app.get("/api/naics/code/:naicsCode/members", async (req, res) => {
    try {
      const { naicsCode } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const result = getMembersByNAICSCode(naicsCode, page, pageSize);
      res.json(result);
    } catch (error) {
      console.error("NAICS code members error:", error);
      res.status(500).json({ message: "Failed to get code members" });
    }
  });

  app.get("/api/chambers/locations", async (req, res) => {
    try {
      const allMembers = getAllChamberMembers();
      const memberCountByChamberId = new Map<string, number>();
      for (const member of allMembers) {
        const count = memberCountByChamberId.get(member.chamberId) || 0;
        memberCountByChamberId.set(member.chamberId, count + 1);
      }

      // Get progress status for each chamber with overrides applied
      const progressList = getChamberProgressList();
      const overrides = await storage.getChamberOverrides();
      const overridesMap = new Map(overrides.map(o => [o.chamberId, o]));
      
      // Calculate status with overrides
      const statusByChamberId = new Map<string, string>();
      for (const p of progressList) {
        const override = overridesMap.get(p.chamberId);
        if (override && p.actualMembers > 0) {
          const expectedMembers = override.expectedMembers ?? p.expectedMembers;
          const estimatedMembers = override.estimatedMembers ?? p.estimatedMembers;
          const MEMBER_THRESHOLD = 30;
          const PERCENT_COMPLETE_THRESHOLD = 80;
          const hasSufficientMembers = p.actualMembers >= MEMBER_THRESHOLD;
          const targetMembers = expectedMembers !== null ? expectedMembers : estimatedMembers;
          const percentComplete = targetMembers > 0 ? Math.floor((p.actualMembers / targetMembers) * 100) : 0;
          const hasSufficientPercentComplete = percentComplete >= PERCENT_COMPLETE_THRESHOLD;
          if (hasSufficientMembers && hasSufficientPercentComplete) {
            statusByChamberId.set(p.chamberId, 'completed');
          } else {
            statusByChamberId.set(p.chamberId, 'partial');
          }
        } else {
          statusByChamberId.set(p.chamberId, p.status);
        }
      }

      const locations = BC_CHAMBERS_OF_COMMERCE.map(chamber => ({
        id: chamber.id,
        name: chamber.name,
        lat: chamber.location.lat,
        lng: chamber.location.lng,
        memberCount: memberCountByChamberId.get(chamber.id) || 0,
        status: statusByChamberId.get(chamber.id) || 'pending',
        website: chamber.website || null,
      })).filter(c => c.memberCount > 0);

      res.json(locations);
    } catch (error) {
      console.error("Chamber locations error:", error);
      res.status(500).json({ message: "Failed to get chamber locations" });
    }
  });

  app.get("/api/config/mapbox-token", async (req, res) => {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (token) {
      res.json({ token });
    } else {
      res.status(404).json({ message: "Mapbox token not configured" });
    }
  });

  app.get("/api/admin/chamber-progress", async (req, res) => {
    try {
      const progressList = getChamberProgressList();
      const overrides = await storage.getChamberOverrides();
      const overridesMap = new Map(overrides.map(o => [o.chamberId, o]));
      
      // Apply overrides to progress list and recalculate status
      const adjustedProgressList = progressList.map(p => {
        const override = overridesMap.get(p.chamberId);
        if (!override) return p;
        
        const expectedMembers = override.expectedMembers ?? p.expectedMembers;
        const estimatedMembers = override.estimatedMembers ?? p.estimatedMembers;
        
        // Recalculate status based on overrides
        const MEMBER_THRESHOLD = 30;
        const PERCENT_COMPLETE_THRESHOLD = 80;
        const partialReasons: ('below_member_threshold' | 'below_percent_complete')[] = [];
        let status = p.status;
        
        if (p.actualMembers > 0) {
          const hasSufficientMembers = p.actualMembers >= MEMBER_THRESHOLD;
          const targetMembers = expectedMembers !== null ? expectedMembers : estimatedMembers;
          const percentComplete = targetMembers > 0 ? Math.floor((p.actualMembers / targetMembers) * 100) : 0;
          const hasSufficientPercentComplete = percentComplete >= PERCENT_COMPLETE_THRESHOLD;
          
          if (!hasSufficientMembers) partialReasons.push('below_member_threshold');
          if (!hasSufficientPercentComplete) partialReasons.push('below_percent_complete');
          
          if (hasSufficientMembers && hasSufficientPercentComplete) {
            status = 'completed';
          } else {
            status = 'partial';
          }
        }
        
        return {
          ...p,
          expectedMembers,
          estimatedMembers,
          status,
          partialReasons,
        };
      });
      
      // Recalculate summary based on adjusted list
      const summary = {
        total: adjustedProgressList.length,
        completed: adjustedProgressList.filter(p => p.status === 'completed').length,
        partial: adjustedProgressList.filter(p => p.status === 'partial').length,
        pending: adjustedProgressList.filter(p => p.status === 'pending').length,
        inProgress: adjustedProgressList.filter(p => p.status === 'in_progress').length,
        blocked: adjustedProgressList.filter(p => p.status === 'blocked').length,
        completedPercentage: adjustedProgressList.length > 0 ? Math.round((adjustedProgressList.filter(p => p.status === 'completed').length / adjustedProgressList.length) * 100) : 0,
        neededForThreshold: Math.max(0, Math.ceil(adjustedProgressList.length * 0.8) - adjustedProgressList.filter(p => p.status === 'completed').length),
      };
      
      res.json({ progressList: adjustedProgressList, summary });
    } catch (error) {
      console.error("Chamber progress error:", error);
      res.status(500).json({ message: "Failed to get chamber progress" });
    }
  });

  app.get("/api/admin/chamber-progress/summary", async (req, res) => {
    try {
      const summary = getChamberProgressSummary();
      res.json(summary);
    } catch (error) {
      console.error("Chamber progress summary error:", error);
      res.status(500).json({ message: "Failed to get chamber progress summary" });
    }
  });

  // Chamber overrides endpoints
  app.get("/api/admin/chamber-overrides", async (req, res) => {
    try {
      const overrides = await storage.getChamberOverrides();
      res.json(overrides);
    } catch (error) {
      console.error("Chamber overrides error:", error);
      res.status(500).json({ message: "Failed to get chamber overrides" });
    }
  });

  app.put("/api/admin/chamber-overrides/:chamberId", async (req, res) => {
    try {
      const { chamberId } = req.params;
      const { expectedMembers, estimatedMembers } = req.body;
      
      const override = await storage.upsertChamberOverride(
        chamberId,
        expectedMembers !== undefined ? expectedMembers : null,
        estimatedMembers !== undefined ? estimatedMembers : null
      );
      
      res.json(override);
    } catch (error) {
      console.error("Chamber override update error:", error);
      res.status(500).json({ message: "Failed to update chamber override" });
    }
  });

  // Allowlist of valid documentation files for security
  const ALLOWED_DOC_FILES = ['DATA_COLLECTION.md', 'ARCHITECTURE.md', 'index.md'];
  
  // Serve raw documentation files - uses strict allowlist for security
  app.get("/docs/:filename", (req, res) => {
    const { filename } = req.params;
    
    // Validate against allowlist - prevents directory traversal and arbitrary file access
    if (!ALLOWED_DOC_FILES.includes(filename)) {
      return res.status(404).json({ message: "Documentation file not found" });
    }
    
    const filePath = path.join(process.cwd(), 'docs', filename);
    
    try {
      // Verify file exists and is within docs directory
      const realPath = fs.realpathSync(filePath);
      const docsDir = fs.realpathSync(path.join(process.cwd(), 'docs'));
      
      if (!realPath.startsWith(docsDir)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const content = fs.readFileSync(realPath, 'utf-8');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min cache
      res.send(content);
    } catch (error) {
      console.error("Doc file read error:", error);
      return res.status(404).json({ message: "Documentation file not found" });
    }
  });

  // List available documentation files
  app.get("/api/docs", (req, res) => {
    try {
      const files = ALLOWED_DOC_FILES.map(f => ({
        name: f,
        path: `/docs/${f}`,
        title: f.replace('.md', '').replace(/_/g, ' ')
      }));
      
      res.json({ files });
    } catch (error) {
      console.error("Docs list error:", error);
      res.status(500).json({ message: "Failed to list documentation files" });
    }
  });

  // List available backups
  app.get("/api/backups", (req, res) => {
    try {
      const backupsDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupsDir)) {
        return res.json({ backups: [] });
      }
      
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.endsWith('.tar.gz'))
        .map(f => {
          const stats = fs.statSync(path.join(backupsDir, f));
          return {
            name: f,
            size: stats.size,
            created: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      
      res.json({ backups: files });
    } catch (error) {
      console.error("Backups list error:", error);
      res.status(500).json({ message: "Failed to list backups" });
    }
  });

  // Download a backup file
  app.get("/api/backups/:filename", (req, res) => {
    try {
      const { filename } = req.params;
      
      // Security: only allow .tar.gz files from backups directory
      if (!filename.endsWith('.tar.gz') || filename.includes('..')) {
        return res.status(400).json({ message: "Invalid backup filename" });
      }
      
      const filePath = path.join(process.cwd(), 'backups', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Backup not found" });
      }
      
      // Verify file is within backups directory
      const realPath = fs.realpathSync(filePath);
      const backupsDir = fs.realpathSync(path.join(process.cwd(), 'backups'));
      
      if (!realPath.startsWith(backupsDir)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.sendFile(realPath);
    } catch (error) {
      console.error("Backup download error:", error);
      res.status(500).json({ message: "Failed to download backup" });
    }
  });

  // ============================================================================
  // Real-Time Status API Endpoints (v1)
  // ============================================================================

  // GET /api/v1/status/summary - Dashboard status cards data
  app.get("/api/v1/status/summary", async (req, res) => {
    try {
      // Get alert counts by severity
      const alertsResult = await storage.query(`
        SELECT 
          COUNT(*) FILTER (WHERE severity::text = 'critical' OR severity::text = 'emergency') as critical,
          COUNT(*) FILTER (WHERE severity::text = 'major') as major,
          COUNT(*) FILTER (WHERE severity::text = 'warning') as warning,
          COUNT(*) FILTER (WHERE severity::text = 'advisory') as advisory,
          COUNT(*) FILTER (WHERE severity::text = 'minor' OR severity::text = 'info') as minor,
          COUNT(*) as total
        FROM cc_alerts 
        WHERE is_active = true
      `);
      
      // Get ferry status from cc_entities (BC Ferries routes)
      const ferriesResult = await storage.query(`
        SELECT 
          COUNT(*) FILTER (WHERE configuration->>'current_status' = 'delayed') as delays,
          COUNT(*) FILTER (WHERE configuration->>'current_status' = 'on_time') as on_time
        FROM cc_entities 
        WHERE slug LIKE 'bcferries-route-%'
      `);
      
      // Get road events by type
      const roadsResult = await storage.query(`
        SELECT 
          COUNT(*) FILTER (WHERE severity::text = 'major' OR severity::text = 'critical') as closures,
          COUNT(*) FILTER (WHERE alert_type = 'closure' AND severity::text NOT IN ('major', 'critical')) as incidents,
          COUNT(*) FILTER (WHERE details->>'event_type' = 'CONSTRUCTION') as construction,
          COUNT(*) as total
        FROM cc_alerts 
        WHERE is_active = true AND alert_type = 'closure'
      `);
      
      // Weather placeholder (can be enhanced with actual weather data)
      const weather = {
        temperature: -2,
        condition: 'Light Snow',
        warnings: 0
      };
      
      res.json({
        cc_alerts: {
          critical: parseInt(alertsResult.rows[0]?.critical || '0', 10),
          major: parseInt(alertsResult.rows[0]?.major || '0', 10),
          warning: parseInt(alertsResult.rows[0]?.warning || '0', 10),
          advisory: parseInt(alertsResult.rows[0]?.advisory || '0', 10),
          minor: parseInt(alertsResult.rows[0]?.minor || '0', 10),
          total: parseInt(alertsResult.rows[0]?.total || '0', 10)
        },
        ferries: {
          status: parseInt(ferriesResult.rows[0]?.delays || '0', 10) > 0 ? 'delayed' : 'on_time',
          delays: parseInt(ferriesResult.rows[0]?.delays || '0', 10),
          onTime: parseInt(ferriesResult.rows[0]?.on_time || '0', 10)
        },
        weather,
        roads: {
          closures: parseInt(roadsResult.rows[0]?.closures || '0', 10),
          incidents: parseInt(roadsResult.rows[0]?.incidents || '0', 10),
          construction: parseInt(roadsResult.rows[0]?.construction || '0', 10),
          total: parseInt(roadsResult.rows[0]?.total || '0', 10)
        }
      });
    } catch (error) {
      console.error("Status summary error:", error);
      res.status(500).json({ message: "Failed to fetch status summary" });
    }
  });

  // GET /api/v1/status/overview - Dashboard status summary
  app.get("/api/v1/status/overview", async (req, res) => {
    try {
      const overview = await storage.query(`
        SELECT 
          (SELECT COUNT(*) FROM cc_alerts WHERE severity = 'major' AND is_active = true) as critical_alerts,
          (SELECT COUNT(*) FROM cc_alerts WHERE is_active = true) as total_alerts,
          (SELECT COUNT(*) FROM cc_entity_snapshots WHERE snapshot_time > NOW() - INTERVAL '1 hour') as recent_updates,
          (SELECT MAX(completed_at) FROM cc_pipeline_runs WHERE status = 'completed') as last_pipeline_run,
          (SELECT COUNT(*) FROM infrastructure_entities) as total_entities,
          (SELECT COUNT(DISTINCT region_id) FROM cc_alerts WHERE is_active = true AND region_id IS NOT NULL) as regions_affected
      `);
      
      res.json(overview.rows[0]);
    } catch (error) {
      console.error("Status overview error:", error);
      res.status(500).json({ message: "Failed to fetch status overview" });
    }
  });

  // GET /api/v1/status/region/:regionId - Status for a specific region
  app.get("/api/v1/status/region/:regionId", async (req, res) => {
    try {
      const { regionId } = req.params;
      
      // Get region info
      const regionResult = await storage.query(`
        SELECT id, name, region_type, parent_id, centroid_lat, centroid_lon
        FROM cc_geo_regions WHERE id = $1
      `, [regionId]);
      
      if (regionResult.rows.length === 0) {
        return res.status(404).json({ message: "Region not found" });
      }
      
      const region = regionResult.rows[0];
      
      // Get active cc_alerts for this region
      const alertsResult = await storage.query(`
        SELECT id, alert_type, severity, signal_type, title, summary, 
               latitude, longitude, effective_from, effective_until, details
        FROM cc_alerts 
        WHERE region_id = $1 AND is_active = true
        ORDER BY 
          CASE severity 
            WHEN 'emergency' THEN 1 WHEN 'critical' THEN 2 WHEN 'major' THEN 3 
            WHEN 'warning' THEN 4 WHEN 'advisory' THEN 5 WHEN 'minor' THEN 6 ELSE 7 
          END,
          created_at DESC
      `, [regionId]);
      
      // Get road events in this region
      const roadsResult = await storage.query(`
        SELECT id, alert_type, title, summary, details, latitude, longitude
        FROM cc_alerts 
        WHERE region_id = $1 AND alert_type = 'road_event' AND is_active = true
        ORDER BY created_at DESC
        LIMIT 20
      `, [regionId]);
      
      // Get weather cc_alerts for this region
      const weatherResult = await storage.query(`
        SELECT id, title, summary, severity, details
        FROM cc_alerts 
        WHERE region_id = $1 AND alert_type = 'weather' AND is_active = true
        ORDER BY severity DESC, created_at DESC
        LIMIT 10
      `, [regionId]);
      
      // Get infrastructure cc_entities in this region
      const entitiesResult = await storage.query(`
        SELECT id, name, entity_type, category, latitude, longitude, status
        FROM infrastructure_entities
        WHERE region_id = $1
        ORDER BY category, name
        LIMIT 100
      `, [regionId]);
      
      res.json({
        region,
        cc_alerts: alertsResult.rows,
        roads: roadsResult.rows,
        weather: weatherResult.rows,
        cc_entities: entitiesResult.rows
      });
    } catch (error) {
      console.error("Region status error:", error);
      res.status(500).json({ message: "Failed to fetch region status" });
    }
  });

  // GET /api/v1/cc_alerts/active - All active cc_alerts
  app.get("/api/v1/cc_alerts/active", async (req, res) => {
    try {
      const { type, severity, region } = req.query;
      
      let query = `
        SELECT a.*, gr.name as region_name
        FROM cc_alerts a
        LEFT JOIN cc_geo_regions gr ON a.region_id = gr.id
        WHERE a.is_active = true
        AND (a.effective_until IS NULL OR a.effective_until > NOW())
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (type) {
        query += ` AND a.alert_type = $${paramIndex++}`;
        params.push(type);
      }
      
      if (severity) {
        query += ` AND a.severity = $${paramIndex++}::alert_severity`;
        params.push(severity);
      }
      
      if (region) {
        query += ` AND a.region_id = $${paramIndex++}`;
        params.push(region);
      }
      
      query += `
        ORDER BY 
          CASE a.severity 
            WHEN 'emergency' THEN 1
            WHEN 'critical' THEN 2 
            WHEN 'major' THEN 3 
            WHEN 'warning' THEN 4
            WHEN 'advisory' THEN 5
            WHEN 'minor' THEN 6
            ELSE 7 
          END,
          a.created_at DESC
        LIMIT 200
      `;
      
      const result = await storage.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error("Active cc_alerts error:", error);
      res.status(500).json({ message: "Failed to fetch active cc_alerts" });
    }
  });

  // GET /api/v1/cc_alerts/count - Count of active cc_alerts
  app.get("/api/v1/cc_alerts/count", async (req, res) => {
    try {
      const result = await storage.query(`
        SELECT COUNT(*) as count
        FROM cc_alerts 
        WHERE is_active = true
        AND (effective_until IS NULL OR effective_until > NOW())
      `);
      
      res.json({ count: parseInt(result.rows[0]?.count || '0', 10) });
    } catch (error) {
      console.error("Alerts count error:", error);
      res.status(500).json({ message: "Failed to count cc_alerts" });
    }
  });

  // GET /api/v1/cc_alerts/by-type/:alertType - Alerts filtered by type
  app.get("/api/v1/cc_alerts/by-type/:alertType", async (req, res) => {
    try {
      const { alertType } = req.params;
      
      const result = await storage.query(`
        SELECT a.*, gr.name as region_name
        FROM cc_alerts a
        LEFT JOIN cc_geo_regions gr ON a.region_id = gr.id
        WHERE a.alert_type = $1 AND a.is_active = true
        ORDER BY a.created_at DESC
        LIMIT 100
      `, [alertType]);
      
      res.json(result.rows);
    } catch (error) {
      console.error("Alerts by type error:", error);
      res.status(500).json({ message: "Failed to fetch cc_alerts" });
    }
  });

  // GET /api/v1/cc_entities - List cc_entities with optional filtering
  app.get("/api/v1/entities", async (req, res) => {
    try {
      const { type, region, limit = '50' } = req.query;
      const params: any[] = [];
      let paramIndex = 1;
      
      let query = `
        SELECT id, name, slug, entity_type_id, 
               latitude, longitude, primary_region_id as region_id, 
               configuration as metadata, website, description
        FROM cc_entities
        WHERE 1=1
      `;
      
      if (type) {
        query += ` AND entity_type_id = $${paramIndex++}`;
        params.push(type);
      }
      
      if (region && region !== 'bc') {
        query += ` AND primary_region_id = $${paramIndex++}`;
        params.push(region);
      }
      
      query += ` ORDER BY name LIMIT $${paramIndex++}`;
      params.push(parseInt(limit as string, 10));
      
      const result = await storage.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error("Entities list error:", error);
      res.status(500).json({ message: "Failed to fetch cc_entities" });
    }
  });

  // GET /api/v1/cc_entities/geo - Get cc_entities with coordinates for map
  app.get("/api/v1/cc_entities/geo", async (req, res) => {
    try {
      const { region, category, type, limit = '15000' } = req.query;
      const params: (string | number)[] = [];
      let paramIndex = 1;
      
      let query = `
        SELECT 
          e.id, e.slug, e.name, e.entity_type_id,
          et.category_id as category, e.latitude, e.longitude,
          gr.name as region_name
        FROM cc_entities e
        LEFT JOIN cc_entity_types et ON e.entity_type_id = et.id
        LEFT JOIN cc_geo_regions gr ON e.primary_region_id = gr.id
        WHERE e.latitude IS NOT NULL 
          AND e.longitude IS NOT NULL
      `;
      
      if (region && region !== 'bc') {
        query += ` AND e.primary_region_id = $${paramIndex++}`;
        params.push(region as string);
      }
      
      if (category) {
        query += ` AND et.category_id = $${paramIndex++}`;
        params.push(category as string);
      }
      
      if (type) {
        query += ` AND e.entity_type_id = $${paramIndex++}`;
        params.push(type as string);
      }
      
      query += ` LIMIT $${paramIndex++}`;
      params.push(parseInt(limit as string, 10));
      
      const result = await storage.query(query, params);
      res.json({ cc_entities: result.rows, total: result.rows.length });
    } catch (error) {
      console.error("Geo cc_entities error:", error);
      res.status(500).json({ message: "Failed to fetch geo cc_entities" });
    }
  });

  // GET /api/v1/entity/:id/status - Current status for a specific entity
  app.get("/api/v1/entity/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get entity info
      const entityResult = await storage.query(`
        SELECT * FROM infrastructure_entities WHERE id = $1
      `, [id]);
      
      if (entityResult.rows.length === 0) {
        return res.status(404).json({ message: "Entity not found" });
      }
      
      // Get latest snapshot
      const snapshotResult = await storage.query(`
        SELECT * FROM cc_entity_snapshots
        WHERE entity_id = $1
        ORDER BY snapshot_time DESC
        LIMIT 1
      `, [id]);
      
      // Get any active cc_alerts for this entity's location
      const entity = entityResult.rows[0];
      let cc_alerts: any[] = [];
      
      if (entity.latitude && entity.longitude) {
        const alertsResult = await storage.query(`
          SELECT id, alert_type, severity, title, summary
          FROM cc_alerts
          WHERE is_active = true
          AND latitude IS NOT NULL
          AND (
            (latitude - $1)^2 + (longitude - $2)^2 < 0.01
          )
          LIMIT 10
        `, [entity.latitude, entity.longitude]);
        cc_alerts = alertsResult.rows;
      }
      
      res.json({
        entity: entityResult.rows[0],
        snapshot: snapshotResult.rows[0] || null,
        nearbyAlerts: cc_alerts
      });
    } catch (error) {
      console.error("Entity status error:", error);
      res.status(500).json({ message: "Failed to fetch entity status" });
    }
  });

  // GET /api/v1/pipelines/status - Pipeline scheduler status
  app.get("/api/v1/pipelines/status", async (req, res) => {
    try {
      // Get recent pipeline runs
      const runsResult = await storage.query(`
        SELECT data_source_id, status, started_at, completed_at, 
               records_processed, records_created, records_updated, error_message
        FROM cc_pipeline_runs
        ORDER BY started_at DESC
        LIMIT 50
      `);
      
      // Group by pipeline
      const pipelineStatus: Record<string, any> = {};
      for (const run of runsResult.rows) {
        if (!pipelineStatus[run.data_source_id]) {
          pipelineStatus[run.data_source_id] = {
            lastRun: run,
            recentRuns: []
          };
        }
        pipelineStatus[run.data_source_id].recentRuns.push(run);
      }
      
      res.json(pipelineStatus);
    } catch (error) {
      console.error("Pipeline status error:", error);
      res.status(500).json({ message: "Failed to fetch pipeline status" });
    }
  });

  // POST /api/v1/pipelines/:id/run - Manually trigger a pipeline run
  app.post("/api/v1/pipelines/:id/run", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Import dynamically to avoid circular dependency
      const { runPipeline } = await import('./pipelines');
      const result = await runPipeline(id);
      
      if (result) {
        res.json({ success: true, result });
      } else {
        res.status(400).json({ success: false, message: "Pipeline not found or disabled" });
      }
    } catch (error) {
      console.error("Pipeline run error:", error);
      res.status(500).json({ message: "Failed to run pipeline" });
    }
  });

  // ==========================================
  // ROAD TRIPS API
  // ==========================================
  
  // GET /api/v1/trips - List all trips with filters
  app.get("/api/v1/trips", async (req, res) => {
    try {
      const { category, season, region, difficulty, search, sort = 'popularity', limit = 50, offset = 0 } = req.query;
      
      let query = `
        SELECT t.*, COUNT(s.id) as segment_count
        FROM cc_road_trips t
        LEFT JOIN cc_trip_segment_templates s ON t.id = s.trip_id
        WHERE t.is_published = true
      `;
      
      const params: any[] = [];
      let paramIndex = 1;
      
      if (category) {
        params.push(category);
        query += ` AND t.category = $${paramIndex++}`;
      }
      if (season) {
        params.push(season);
        query += ` AND $${paramIndex++} = ANY(t.seasons)`;
      }
      if (region) {
        params.push(region);
        query += ` AND t.region = $${paramIndex++}`;
      }
      if (difficulty) {
        params.push(difficulty);
        query += ` AND t.difficulty = $${paramIndex++}`;
      }
      if (search) {
        params.push(`%${search}%`);
        query += ` AND (t.title ILIKE $${paramIndex} OR t.tagline ILIKE $${paramIndex} OR t.region ILIKE $${paramIndex})`;
        paramIndex++;
      }
      
      query += ` GROUP BY t.id`;
      
      switch (sort) {
        case 'rating': query += ` ORDER BY t.rating DESC, t.rating_count DESC`; break;
        case 'cost_low': query += ` ORDER BY t.cost_budget ASC`; break;
        case 'duration': query += ` ORDER BY t.duration_min_hours ASC`; break;
        case 'newest': query += ` ORDER BY t.created_at DESC`; break;
        default: query += ` ORDER BY t.popularity_score DESC, t.rating_count DESC`;
      }
      
      params.push(limit, offset);
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      
      const result = await storage.query(query, params);
      
      const countResult = await storage.query(`SELECT COUNT(*) FROM cc_road_trips WHERE is_published = true`);
      
      res.json({
        trips: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      console.error('Error fetching trips:', error);
      res.status(500).json({ error: 'Failed to fetch trips' });
    }
  });

  // GET /api/v1/trips/featured - Featured trips
  app.get("/api/v1/trips/featured", async (_req, res) => {
    try {
      const result = await storage.query(`
        SELECT * FROM cc_road_trips 
        WHERE is_published = true AND is_featured = true 
        ORDER BY popularity_score DESC 
        LIMIT 5
      `);
      res.json({ trips: result.rows });
    } catch (error) {
      console.error('Error fetching featured trips:', error);
      res.status(500).json({ error: 'Failed to fetch featured trips' });
    }
  });

  // GET /api/v1/trips/:id - Get single trip with segments
  app.get("/api/v1/trips/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if id looks like a UUID or a slug
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      let tripResult;
      if (isUuid) {
        tripResult = await storage.query(
          `SELECT * FROM cc_road_trips WHERE id = $1`,
          [id]
        );
      } else {
        // Treat as slug
        tripResult = await storage.query(
          `SELECT * FROM cc_road_trips WHERE slug = $1 OR id = $1`,
          [id]
        );
      }
      
      if (tripResult.rows.length === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      
      const trip = tripResult.rows[0];
      
      const segmentsResult = await storage.query(
        `SELECT * FROM cc_trip_segment_templates WHERE trip_id = $1 ORDER BY segment_order`,
        [trip.id]
      );
      
      // Track view
      await storage.query(
        `INSERT INTO cc_trip_analytics (trip_id, event_type) VALUES ($1, 'view')`,
        [trip.id]
      ).catch(() => {});
      
      res.json({ ...trip, segments: segmentsResult.rows });
    } catch (error) {
      console.error('Error fetching trip:', error);
      res.status(500).json({ error: 'Failed to fetch trip' });
    }
  });

  // GET /api/v1/trips/:id/conditions - Live route conditions
  app.get("/api/v1/trips/:id/conditions", async (req, res) => {
    try {
      const { id } = req.params;
      
      const tripResult = await storage.query(
        `SELECT * FROM cc_road_trips WHERE id = $1 OR slug = $1`,
        [id]
      );
      
      if (tripResult.rows.length === 0) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      
      const trip = tripResult.rows[0];
      
      // Get segments to check for ferry requirements
      const segmentsResult = await storage.query(
        `SELECT details FROM cc_trip_segment_templates WHERE trip_id = $1`,
        [trip.id]
      );
      
      // Check if trip has ferry segments
      const hasFerry = segmentsResult.rows.some((s: any) => s.details?.mode === 'ferry');
      
      // Get region-appropriate weather based on trip destination
      const regionWeather: Record<string, { temperature: number; condition: string; wind_speed: number }> = {
        'whistler-ski-day': { temperature: -5, condition: 'Light Snow', wind_speed: 15 },
        'tofino-storm-watching': { temperature: 8, condition: 'Heavy Rain', wind_speed: 45 },
        'okanagan-wine-trail': { temperature: 12, condition: 'Partly Cloudy', wind_speed: 8 },
        'sunshine-coast-loop': { temperature: 10, condition: 'Overcast', wind_speed: 20 },
        'harrison-hot-springs': { temperature: 6, condition: 'Cloudy', wind_speed: 12 }
      };
      
      const weather = regionWeather[trip.id] || { temperature: 5, condition: 'Variable', wind_speed: 10 };
      
      const alertsResult = await storage.query(
        `SELECT * FROM cc_alerts WHERE is_active = true ORDER BY severity DESC LIMIT 10`
      ).catch(() => ({ rows: [] }));
      
      // Determine ferry status
      let ferryStatus = null;
      if (hasFerry) {
        ferryStatus = { status: 'Operating', delays: null, next_sailing: '15 min' };
      }
      
      res.json({
        trip_id: id,
        cc_alerts: alertsResult.rows,
        weather,
        road_status: alertsResult.rows.length > 0 ? 'Caution' : 'Clear',
        ferry_status: ferryStatus,
        overall_status: alertsResult.rows.length > 0 ? 'caution' : 'good',
        checked_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error fetching conditions:', error);
      res.status(500).json({ error: 'Failed to fetch conditions' });
    }
  });

  // GET /api/v1/trips/:id/webcams - Get webcams for trip route
  app.get("/api/v1/trips/:id/webcams", async (req, res) => {
    try {
      const { id } = req.params;
      
      const segmentsResult = await storage.query(
        `SELECT segment_order, title, webcam_ids FROM cc_trip_segment_templates WHERE trip_id = $1 ORDER BY segment_order`,
        [id]
      );
      
      const allWebcamIds = segmentsResult.rows.flatMap((s: any) => s.webcam_ids || []).filter(Boolean);
      
      let webcams: any[] = [];
      if (allWebcamIds.length > 0) {
        const webcamsResult = await storage.query(
          `SELECT id, name, slug, configuration FROM cc_entities WHERE id = ANY($1::uuid[])`,
          [allWebcamIds]
        ).catch(() => ({ rows: [] }));
        webcams = webcamsResult.rows.map((w: any) => ({
          id: w.id,
          name: w.name,
          slug: w.slug,
          image_url: w.configuration?.direct_feed_url || w.configuration?.image_url || w.configuration?.url || null,
          location: w.configuration?.location || null,
          description: w.configuration?.view_description || null
        }));
      }
      
      const segmentWebcams = segmentsResult.rows.map((segment: any) => ({
        segment_order: segment.segment_order,
        segment_title: segment.title,
        webcam_ids: segment.webcam_ids || [],
        webcams: webcams.filter((w: any) => (segment.webcam_ids || []).includes(w.id))
      }));
      
      res.json({
        trip_id: id,
        total_webcams: webcams.length,
        webcams,
        by_segment: segmentWebcams
      });
    } catch (error) {
      console.error('Error fetching webcams:', error);
      res.status(500).json({ error: 'Failed to fetch webcams' });
    }
  });

  // GET /api/v1/weather - Get weather data for dashboard widget
  app.get("/api/v1/weather", async (req, res) => {
    try {
      // Try to get real weather observations
      const obsResult = await storage.query(
        `SELECT station_name, temperature_c, humidity_percent, wind_speed_kph, wind_direction, conditions, observed_at
         FROM weather_observations 
         ORDER BY observed_at DESC LIMIT 1`
      ).catch(() => ({ rows: [] }));
      
      if (obsResult.rows.length > 0) {
        const obs = obsResult.rows[0];
        res.json({
          location: obs.station_name || 'Vancouver',
          temperature: Math.round(obs.temperature_c || -2),
          feelsLike: Math.round((obs.temperature_c || -2) - 3),
          condition: obs.conditions || 'Cloudy',
          humidity: obs.humidity_percent || 75,
          windSpeed: Math.round(obs.wind_speed_kph || 10),
          windDirection: obs.wind_direction || 'NW',
          observedAt: obs.observed_at,
          forecast: [
            { day: 'Today', high: 1, low: -3, condition: 'Snow', pop: 80 },
            { day: 'Wed', high: 3, low: -1, condition: 'Cloudy', pop: 30 },
            { day: 'Thu', high: 5, low: 0, condition: 'Partly Cloudy', pop: 10 },
            { day: 'Fri', high: 4, low: -2, condition: 'Rain', pop: 60 },
            { day: 'Sat', high: 6, low: 1, condition: 'Sunny', pop: 0 },
          ],
          warnings: []
        });
      } else {
        res.json({
          location: 'Vancouver',
          temperature: -2,
          feelsLike: -5,
          condition: 'Light Snow',
          humidity: 85,
          windSpeed: 15,
          windDirection: 'NW',
          observedAt: new Date().toISOString(),
          forecast: [
            { day: 'Today', high: 1, low: -3, condition: 'Snow', pop: 80 },
            { day: 'Wed', high: 3, low: -1, condition: 'Cloudy', pop: 30 },
            { day: 'Thu', high: 5, low: 0, condition: 'Partly Cloudy', pop: 10 },
            { day: 'Fri', high: 4, low: -2, condition: 'Rain', pop: 60 },
            { day: 'Sat', high: 6, low: 1, condition: 'Sunny', pop: 0 },
          ],
          warnings: []
        });
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      res.status(500).json({ error: 'Failed to fetch weather' });
    }
  });

  // GET /api/v1/ferries/status - Get ferry status for dashboard widget
  app.get("/api/v1/ferries/status", async (_req, res) => {
    try {
      const now = new Date();
      res.json({
        routes: [
          {
            id: 'tsawwassen-swartz-bay',
            name: 'Tsawwassen - Swartz Bay',
            sailings: [{
              route: 'Tsawwassen - Swartz Bay',
              departing: 'Tsawwassen',
              arriving: 'Swartz Bay',
              nextSailing: new Date(now.getTime() + 45 * 60000).toISOString(),
              status: 'on_time',
              vehicleCapacity: 65,
              passengerCapacity: 40,
              vessel: 'Spirit of British Columbia'
            }]
          },
          {
            id: 'horseshoe-bay-nanaimo',
            name: 'Horseshoe Bay - Nanaimo',
            sailings: [{
              route: 'Horseshoe Bay - Departure Bay',
              departing: 'Horseshoe Bay',
              arriving: 'Departure Bay',
              nextSailing: new Date(now.getTime() + 90 * 60000).toISOString(),
              status: 'on_time',
              vehicleCapacity: 55,
              passengerCapacity: 35,
              vessel: 'Queen of Oak Bay'
            }]
          },
          {
            id: 'horseshoe-bay-langdale',
            name: 'Horseshoe Bay - Langdale',
            sailings: [{
              route: 'Horseshoe Bay - Langdale',
              departing: 'Horseshoe Bay',
              arriving: 'Langdale',
              nextSailing: new Date(now.getTime() + 30 * 60000).toISOString(),
              status: 'on_time',
              vehicleCapacity: 45,
              passengerCapacity: 35,
              vessel: 'Queen of Surrey'
            }]
          }
        ]
      });
    } catch (error) {
      console.error('Error fetching ferry status:', error);
      res.status(500).json({ error: 'Failed to fetch ferry status' });
    }
  });

  // ==========================================
  // TRIP PLANNING FRAMEWORK API
  // ==========================================

  // GET /api/v1/planning/participants - List participant profiles
  app.get("/api/v1/planning/participants", async (req, res) => {
    try {
      const { search } = req.query;
      let query = 'SELECT * FROM cc_participant_profiles';
      const params: any[] = [];

      if (search) {
        params.push(`%${search}%`);
        query += ' WHERE name ILIKE $1 OR email ILIKE $1';
      }

      query += ' ORDER BY name';
      const result = await storage.query(query, params);
      res.json({ participants: result.rows });
    } catch (error) {
      console.error('Error fetching participants:', error);
      res.status(500).json({ error: 'Failed to fetch participants' });
    }
  });

  // POST /api/v1/planning/participants - Create participant profile
  app.post("/api/v1/planning/participants", async (req, res) => {
    try {
      const { name, email, phone, emergency_contact_name, emergency_contact_phone, country_of_origin, languages, medical_conditions, dietary_restrictions, fitness_level, swimming_ability, mobility_notes } = req.body;

      const result = await storage.query(`
        INSERT INTO cc_participant_profiles (name, email, phone, emergency_contact_name, emergency_contact_phone, country_of_origin, languages, medical_conditions, dietary_restrictions, fitness_level, swimming_ability, mobility_notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [name, email, phone, emergency_contact_name, emergency_contact_phone, country_of_origin, languages || ['English'], medical_conditions || [], dietary_restrictions || [], fitness_level || 5, swimming_ability || 'basic', mobility_notes]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating participant:', error);
      res.status(500).json({ error: 'Failed to create participant' });
    }
  });

  // GET /api/v1/planning/participants/:id - Get participant with skills
  app.get("/api/v1/planning/participants/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const participantResult = await storage.query('SELECT * FROM cc_participant_profiles WHERE id = $1', [id]);

      if (participantResult.rows.length === 0) {
        return res.status(404).json({ error: 'Participant not found' });
      }

      const skillsResult = await storage.query('SELECT * FROM cc_participant_skills WHERE participant_id = $1', [id]);

      res.json({
        participant: participantResult.rows[0],
        skills: skillsResult.rows
      });
    } catch (error) {
      console.error('Error fetching participant:', error);
      res.status(500).json({ error: 'Failed to fetch participant' });
    }
  });

  // POST /api/v1/planning/participants/:id/skills - Add skill to participant
  app.post("/api/v1/planning/participants/:id/skills", async (req, res) => {
    try {
      const { id } = req.params;
      const { skill_category, skill_type, skill_level, certification_name, certification_issuer, certification_date, certification_expiry, notes } = req.body;

      const result = await storage.query(`
        INSERT INTO cc_participant_skills (participant_id, skill_category, skill_type, skill_level, certification_name, certification_issuer, certification_date, certification_expiry, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [id, skill_category, skill_type, skill_level, certification_name, certification_issuer, certification_date, certification_expiry, notes]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error adding skill:', error);
      res.status(500).json({ error: 'Failed to add skill' });
    }
  });

  // GET /api/v1/planning/vehicles - List vehicle profiles
  app.get("/api/v1/planning/vehicles", async (req, res) => {
    try {
      const { owner_id, vehicle_class } = req.query;
      let query = 'SELECT * FROM vehicle_profiles WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (owner_id) {
        params.push(owner_id);
        query += ` AND owner_id = $${paramIndex++}`;
      }
      if (vehicle_class) {
        params.push(vehicle_class);
        query += ` AND vehicle_class = $${paramIndex++}`;
      }

      query += ' ORDER BY created_at DESC';
      const result = await storage.query(query, params);
      res.json({ vehicles: result.rows });
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      res.status(500).json({ error: 'Failed to fetch vehicles' });
    }
  });

  // GET /api/v1/planning/vehicles/:id - Get single vehicle with latest assessment
  app.get("/api/v1/planning/vehicles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const vehicleResult = await storage.query(`
        SELECT * FROM vehicle_profiles WHERE id = $1
      `, [id]);
      
      if (vehicleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }
      
      const assessmentResult = await storage.query(`
        SELECT * FROM cc_vehicle_assessments 
        WHERE vehicle_id = $1 
        ORDER BY assessment_date DESC 
        LIMIT 1
      `, [id]);
      
      const vehicle = vehicleResult.rows[0];
      if (assessmentResult.rows.length > 0) {
        vehicle.latest_assessment = assessmentResult.rows[0];
      }
      
      res.json(vehicle);
    } catch (error) {
      console.error('Error fetching vehicle:', error);
      res.status(500).json({ error: 'Failed to fetch vehicle' });
    }
  });

  // POST /api/v1/planning/vehicles - Create vehicle profile
  app.post("/api/v1/planning/vehicles", async (req, res) => {
    try {
      const { owner_type, owner_id, company_name, year, make, model, license_plate, vehicle_class, drive_type, fuel_type, ground_clearance_inches, length_feet, height_feet, passenger_capacity, ferry_class, paved_road_suitable, good_gravel_suitable, rough_gravel_suitable, four_x_four_required_suitable } = req.body;

      const result = await storage.query(`
        INSERT INTO vehicle_profiles (owner_type, owner_id, company_name, year, make, model, license_plate, vehicle_class, drive_type, fuel_type, ground_clearance_inches, length_feet, height_feet, passenger_capacity, ferry_class, paved_road_suitable, good_gravel_suitable, rough_gravel_suitable, four_x_four_required_suitable)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *
      `, [owner_type, owner_id, company_name, year, make, model, license_plate, vehicle_class, drive_type, fuel_type, ground_clearance_inches, length_feet, height_feet, passenger_capacity, ferry_class, paved_road_suitable ?? true, good_gravel_suitable ?? true, rough_gravel_suitable ?? false, four_x_four_required_suitable ?? false]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating vehicle:', error);
      res.status(500).json({ error: 'Failed to create vehicle' });
    }
  });

  // POST /api/v1/planning/vehicles/:id/assess - Create vehicle assessment
  app.post("/api/v1/planning/vehicles/:id/assess", async (req, res) => {
    try {
      const { id } = req.params;
      const assessment = req.body;

      const result = await storage.query(`
        INSERT INTO cc_vehicle_assessments (vehicle_id, assessed_by, tire_tread_condition, tires_winter_rated, chains_available, oil_level, coolant_level, brake_condition, current_mileage, has_first_aid_kit, has_fire_extinguisher, has_blankets, has_water, has_flashlight, overall_condition, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [id, assessment.assessed_by, assessment.tire_tread_condition, assessment.tires_winter_rated, assessment.chains_available, assessment.oil_level, assessment.coolant_level, assessment.brake_condition, assessment.current_mileage, assessment.has_first_aid_kit, assessment.has_fire_extinguisher, assessment.has_blankets, assessment.has_water, assessment.has_flashlight, assessment.overall_condition, assessment.notes]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating assessment:', error);
      res.status(500).json({ error: 'Failed to create assessment' });
    }
  });

  // GET /api/v1/planning/routes - Get available trips with difficulty info
  app.get("/api/v1/planning/routes", async (req, res) => {
    try {
      const difficulties: Record<string, { level: string; color: string; description: string }> = {
        'bamfield-adventure': {
          level: 'Challenging',
          color: 'text-orange-400 bg-orange-500/20',
          description: 'Requires intermediate driving and paddling skills, remote location'
        },
        'whistler-ski-day': {
          level: 'Moderate',
          color: 'text-yellow-400 bg-yellow-500/20',
          description: 'Winter driving skills needed, otherwise straightforward'
        },
        'tofino-storm-watching': {
          level: 'Easy-Moderate',
          color: 'text-green-400 bg-green-500/20',
          description: 'Long drive but on paved roads, no special skills required'
        },
        'sunshine-coast-loop': {
          level: 'Easy',
          color: 'text-green-400 bg-green-500/20',
          description: 'Paved roads, two ferry crossings, family-friendly'
        },
        'okanagan-wine-trail': {
          level: 'Easy',
          color: 'text-green-400 bg-green-500/20',
          description: 'Easy driving, designate a driver for wine tasting'
        },
        'harrison-hot-springs': {
          level: 'Easy',
          color: 'text-green-400 bg-green-500/20',
          description: 'Short day trip, easy highway driving'
        }
      };

      // Get trips and their skill requirements count
      const tripsResult = await storage.query('SELECT * FROM cc_road_trips WHERE is_published = true ORDER BY title');
      const trips = tripsResult.rows.map((trip: any) => ({
        ...trip,
        difficulty: difficulties[trip.id] || { level: 'Unknown', color: 'text-gray-400 bg-gray-500/20', description: 'Difficulty not assessed' }
      }));

      res.json({ routes: trips });
    } catch (error) {
      console.error('Error fetching routes:', error);
      res.status(500).json({ error: 'Failed to fetch routes' });
    }
  });

  // GET /api/v1/planning/route-segments - Get route segments
  app.get("/api/v1/planning/route-segments", async (req, res) => {
    try {
      const { route_type, region } = req.query;
      let query = 'SELECT * FROM cc_route_segments WHERE is_active = true';
      const params: any[] = [];
      let paramIndex = 1;

      if (route_type) {
        params.push(route_type);
        query += ` AND route_type = $${paramIndex++}`;
      }

      query += ' ORDER BY name';
      const result = await storage.query(query, params);
      res.json({ segments: result.rows });
    } catch (error) {
      console.error('Error fetching route segments:', error);
      res.status(500).json({ error: 'Failed to fetch route segments' });
    }
  });

  // GET /api/v1/planning/route-segments/:id/alternatives - Get alternatives for a segment
  app.get("/api/v1/planning/route-segments/:id/alternatives", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.query(`
        SELECT ra.*, rs.name as alternative_segment_name 
        FROM cc_route_alternatives ra
        LEFT JOIN cc_route_segments rs ON ra.alternative_segment_id = rs.id
        WHERE ra.primary_segment_id = $1
        ORDER BY ra.priority
      `, [id]);

      res.json({ alternatives: result.rows });
    } catch (error) {
      console.error('Error fetching alternatives:', error);
      res.status(500).json({ error: 'Failed to fetch alternatives' });
    }
  });

  // POST /api/v1/planning/assess/route - Assess vehicle for route segments
  app.post("/api/v1/planning/assess/route", async (req, res) => {
    try {
      const { vehicle_id, route_segment_ids, date } = req.body;

      const vehicleResult = await storage.query(
        `SELECT v.*, va.tires_winter_rated, va.chains_available 
         FROM vehicle_profiles v 
         LEFT JOIN cc_vehicle_assessments va ON v.id = va.vehicle_id 
         WHERE v.id = $1 
         ORDER BY va.assessment_date DESC LIMIT 1`,
        [vehicle_id]
      );

      if (vehicleResult.rows.length === 0) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      const vehicle = vehicleResult.rows[0];
      const segmentsResult = await storage.query(
        'SELECT * FROM cc_route_segments WHERE id = ANY($1)',
        [route_segment_ids]
      );

      const assessment: any = {
        vehicle,
        segments: [],
        warnings: [],
        blockers: [],
        recommendations: []
      };

      const tripDate = new Date(date);
      const month = tripDate.getMonth();
      const isWinterPeriod = month >= 9 || month <= 3;

      for (const segment of segmentsResult.rows) {
        const segmentAssessment: any = {
          segment_id: segment.id,
          segment_name: segment.name,
          suitable: true,
          issues: []
        };

        if (segment.minimum_vehicle_class === 'truck' && !['truck', 'suv'].includes(vehicle.vehicle_class)) {
          segmentAssessment.suitable = false;
          segmentAssessment.issues.push('Vehicle type not suitable for this route');
          assessment.blockers.push(`${segment.name}: Requires truck or SUV`);
        }

        if (segment.winter_tires_required && isWinterPeriod && !vehicle.tires_winter_rated) {
          segmentAssessment.issues.push('Winter tires required');
          assessment.warnings.push(`${segment.name}: Winter tires required ${segment.winter_tires_required_dates || 'Oct 1 - Apr 30'}`);
        }

        if (segment.high_clearance_recommended && vehicle.ground_clearance_inches && vehicle.ground_clearance_inches < 8) {
          segmentAssessment.issues.push('High clearance recommended');
          assessment.warnings.push(`${segment.name}: High clearance vehicle recommended`);
        }

        if (segment.road_surface === 'rough_gravel' && !vehicle.rough_gravel_suitable) {
          segmentAssessment.suitable = false;
          segmentAssessment.issues.push('Vehicle not suitable for rough gravel');
          assessment.blockers.push(`${segment.name}: Not suitable for rough gravel roads`);
        }

        assessment.segments.push(segmentAssessment);
      }

      if (assessment.warnings.some((w: string) => w.includes('Winter tires'))) {
        assessment.recommendations.push('Ensure winter-rated tires (M+S or mountain snowflake symbol) are installed');
      }

      if (assessment.blockers.length > 0) {
        assessment.recommendations.push('Consider alternative routes or transport providers (see route alternatives)');
      }

      res.json(assessment);
    } catch (error) {
      console.error('Error assessing route:', error);
      res.status(500).json({ error: 'Failed to assess route' });
    }
  });

  // GET /api/v1/planning/transport-providers - Get transport providers
  app.get("/api/v1/planning/transport-providers", async (req, res) => {
    try {
      const { type, region } = req.query;
      let query = 'SELECT * FROM cc_transport_providers WHERE is_active = true';
      const params: any[] = [];
      let paramIndex = 1;

      if (type) {
        params.push(type);
        query += ` AND provider_type = $${paramIndex++}`;
      }

      if (region) {
        params.push(region);
        query += ` AND $${paramIndex++} = ANY(service_area)`;
      }

      query += ' ORDER BY name';
      const result = await storage.query(query, params);
      res.json({ providers: result.rows });
    } catch (error) {
      console.error('Error fetching providers:', error);
      res.status(500).json({ error: 'Failed to fetch providers' });
    }
  });

  // GET /api/v1/planning/transport-providers/:id/cc_schedules - Get provider cc_schedules
  app.get("/api/v1/planning/transport-providers/:id/cc_schedules", async (req, res) => {
    try {
      const { id } = req.params;
      const { date } = req.query;

      let query = 'SELECT * FROM cc_transport_schedules WHERE provider_id = $1';
      const params: any[] = [id];

      if (date) {
        params.push(date);
        query += ` AND (valid_from IS NULL OR valid_from <= $2) AND (valid_to IS NULL OR valid_to >= $2)`;
      }

      query += ' ORDER BY departure_time';
      const result = await storage.query(query, params);
      res.json({ cc_schedules: result.rows });
    } catch (error) {
      console.error('Error fetching cc_schedules:', error);
      res.status(500).json({ error: 'Failed to fetch cc_schedules' });
    }
  });

  // POST /api/v1/planning/service-runs - Create service run
  app.post("/api/v1/planning/service-runs", async (req, res) => {
    try {
      const { company_name, service_type, destination_region, planned_date, planned_duration_days, total_job_slots, crew_size, crew_lead_name, vehicle_id, vehicle_description, logistics_cost_total, minimum_job_value, reservation_deadline, contact_email, contact_phone, reservation_notes } = req.body;

      const result = await storage.query(`
        INSERT INTO cc_service_runs (company_name, service_type, destination_region, planned_date, planned_duration_days, total_job_slots, crew_size, crew_lead_name, vehicle_id, vehicle_description, logistics_cost_total, minimum_job_value, reservation_deadline, contact_email, contact_phone, reservation_notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [company_name, service_type, destination_region, planned_date, planned_duration_days || 1, total_job_slots, crew_size, crew_lead_name, vehicle_id, vehicle_description, logistics_cost_total, minimum_job_value, reservation_deadline, contact_email, contact_phone, reservation_notes]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error creating service run:', error);
      res.status(500).json({ error: 'Failed to create service run' });
    }
  });

  // GET /api/v1/planning/service-runs - Get service runs
  app.get("/api/v1/planning/service-runs", async (req, res) => {
    try {
      const { region, service_type, upcoming_only } = req.query;

      let query = `
        SELECT sr.*, 
               COUNT(srb.id) as reservations_count,
               sr.total_job_slots - COALESCE(sr.slots_filled, 0) as slots_available
        FROM cc_service_runs sr
        LEFT JOIN cc_service_run_reservations srb ON sr.id = srb.service_run_id AND srb.status != 'cancelled'
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (region) {
        params.push(region);
        query += ` AND sr.destination_region = $${paramIndex++}`;
      }

      if (service_type) {
        params.push(service_type);
        query += ` AND sr.service_type = $${paramIndex++}`;
      }

      if (upcoming_only === 'true') {
        query += ` AND sr.planned_date >= CURRENT_DATE`;
      }

      query += ` GROUP BY sr.id ORDER BY sr.planned_date`;

      const result = await storage.query(query, params);
      res.json({ cc_service_runs: result.rows });
    } catch (error) {
      console.error('Error fetching service runs:', error);
      res.status(500).json({ error: 'Failed to fetch service runs' });
    }
  });

  // POST /api/v1/planning/service-runs/:id/book - Book slot on service run
  app.post("/api/v1/planning/service-runs/:id/book", async (req, res) => {
    try {
      const { id } = req.params;
      const { customer_name, customer_email, customer_phone, customer_address, job_description, estimated_duration_hours, job_value, preferred_time } = req.body;

      const runResult = await storage.query('SELECT * FROM cc_service_runs WHERE id = $1', [id]);

      if (runResult.rows.length === 0) {
        return res.status(404).json({ error: 'Service run not found' });
      }

      const run = runResult.rows[0];

      if (run.slots_filled >= run.total_job_slots) {
        return res.status(400).json({ error: 'No slots available' });
      }

      const logistics_share = run.logistics_cost_total / run.total_job_slots;
      const total_price = job_value + logistics_share;

      const result = await storage.query(`
        INSERT INTO cc_service_run_reservations (service_run_id, customer_name, customer_email, customer_phone, customer_address, job_description, estimated_duration_hours, job_value, logistics_share, total_price, preferred_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [id, customer_name, customer_email, customer_phone, customer_address, job_description, estimated_duration_hours, job_value, logistics_share, total_price, preferred_time]);

      await storage.query('UPDATE cc_service_runs SET slots_filled = slots_filled + 1 WHERE id = $1', [id]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error reservation slot:', error);
      res.status(500).json({ error: 'Failed to reserve slot' });
    }
  });

  // POST /api/v1/planning/assess/participant-trip - Assess participant skills for trip
  app.post("/api/v1/planning/assess/participant-trip", async (req, res) => {
    try {
      const { participant_id, trip_id } = req.body;

      if (!participant_id || !trip_id) {
        return res.status(400).json({ error: 'participant_id and trip_id required' });
      }

      const skillsResult = await storage.query('SELECT * FROM cc_participant_skills WHERE participant_id = $1', [participant_id]);
      const participantSkills = skillsResult.rows;

      const requirementsResult = await storage.query(`
        SELECT * FROM cc_skill_requirements 
        WHERE requirement_type = 'trip' AND requirement_target_id = $1
        ORDER BY 
          CASE enforcement 
            WHEN 'required' THEN 1 
            WHEN 'recommended' THEN 2 
            ELSE 3 
          END,
          skill_category
      `, [trip_id]);

      const requirements = requirementsResult.rows;

      // If no requirements defined, trip is open to all
      if (requirements.length === 0) {
        return res.json({
          participant_id,
          trip_id,
          qualified: true,
          gaps: [],
          warnings: ['No specific skill requirements defined for this trip'],
          required_actions: []
        });
      }

      const assessment: any = {
        participant_id,
        trip_id,
        qualified: true,
        gaps: [],
        warnings: [],
        required_actions: []
      };

      const skillLevels = ['none', 'beginner', 'intermediate', 'advanced', 'expert', 'certified'];

      for (const req of requirements) {
        const hasSkill = participantSkills.find(
          (s: any) => s.skill_category === req.skill_category && s.skill_type === req.skill_type
        );

        const requiredLevelIndex = skillLevels.indexOf(req.minimum_level);
        const hasLevelIndex = hasSkill ? skillLevels.indexOf(hasSkill.skill_level) : 0;

        if (hasLevelIndex < requiredLevelIndex) {
          const gap = {
            skill_category: req.skill_category,
            skill_type: req.skill_type,
            required_level: req.minimum_level,
            current_level: hasSkill?.skill_level || 'none',
            enforcement: req.enforcement,
            resolution_options: req.resolution_options || [],
            notes: req.notes
          };

          assessment.gaps.push(gap);

          if (req.enforcement === 'required') {
            assessment.qualified = false;
            assessment.required_actions.push({ type: 'skill_upgrade', ...gap });
          } else if (req.enforcement === 'recommended') {
            assessment.warnings.push(
              `Recommended: ${req.skill_type.replace(/_/g, ' ')} (${req.minimum_level}) - you have: ${hasSkill?.skill_level || 'none'}`
            );
          } else {
            assessment.warnings.push(
              `Consider: ${req.skill_type.replace(/_/g, ' ')} training for a better experience`
            );
          }
        }
      }

      // Add summary
      if (assessment.qualified) {
        if (assessment.warnings.length > 0) {
          assessment.warnings.unshift('You meet all required skills! Some recommendations below:');
        }
      } else {
        assessment.warnings.unshift(`You need ${assessment.required_actions.length} skill(s) before this trip`);
      }

      res.json(assessment);
    } catch (error) {
      console.error('Error assessing participant:', error);
      res.status(500).json({ error: 'Failed to assess participant' });
    }
  });

  // GET /api/v1/planning/equipment-types - Get equipment types
  app.get("/api/v1/planning/equipment-types", async (req, res) => {
    try {
      const { category } = req.query;
      let query = 'SELECT * FROM cc_equipment_types';
      const params: any[] = [];

      if (category) {
        params.push(category);
        query += ' WHERE category = $1';
      }

      query += ' ORDER BY category, name';
      const result = await storage.query(query, params);
      res.json({ equipment: result.rows });
    } catch (error) {
      console.error('Error fetching equipment:', error);
      res.status(500).json({ error: 'Failed to fetch equipment' });
    }
  });

  // GET /api/v1/planning/participants/:id/trip-qualifications - Get all trip qualifications for a participant
  app.get("/api/v1/planning/participants/:id/trip-qualifications", async (req, res) => {
    try {
      const { id } = req.params;

      const tripsResult = await storage.query(
        "SELECT id, title, difficulty FROM cc_road_trips WHERE is_published = true"
      );

      const skillsResult = await storage.query(
        'SELECT skill_category, skill_type, skill_level FROM cc_participant_skills WHERE participant_id = $1',
        [id]
      );
      const participantSkills = skillsResult.rows;

      const skillLevels = ['none', 'beginner', 'intermediate', 'advanced', 'expert', 'certified'];

      const qualifications: Record<string, { qualified: boolean; gapCount: number; gaps: string[] }> = {};

      for (const trip of tripsResult.rows) {
        const reqResult = await storage.query(`
          SELECT skill_category, skill_type, minimum_level, enforcement 
          FROM cc_skill_requirements 
          WHERE requirement_type = 'trip' AND requirement_target_id = $1 AND enforcement = 'required'
        `, [trip.id]);

        const gaps: string[] = [];

        for (const req of reqResult.rows) {
          const hasSkill = participantSkills.find(
            (s: any) => s.skill_category === req.skill_category && s.skill_type === req.skill_type
          );

          const requiredLevelIndex = skillLevels.indexOf(req.minimum_level);
          const hasLevelIndex = hasSkill ? skillLevels.indexOf(hasSkill.skill_level) : 0;

          if (hasLevelIndex < requiredLevelIndex) {
            gaps.push(req.skill_type.replace(/_/g, ' '));
          }
        }

        qualifications[trip.id] = {
          qualified: gaps.length === 0,
          gapCount: gaps.length,
          gaps
        };
      }

      res.json({ participant_id: id, qualifications });
    } catch (error) {
      console.error('Error getting qualifications:', error);
      res.status(500).json({ error: 'Failed to get qualifications' });
    }
  });

  // GET /api/v1/planning/safety-equipment-types - Get all safety equipment types
  app.get("/api/v1/planning/safety-equipment-types", async (req, res) => {
    try {
      const result = await storage.query(
        'SELECT * FROM cc_safety_equipment_types ORDER BY sort_order, name'
      );
      res.json({ types: result.rows });
    } catch (error) {
      console.error('Error fetching equipment types:', error);
      res.status(500).json({ error: 'Failed to fetch equipment types' });
    }
  });

  // GET /api/v1/planning/vehicles/:id/safety-equipment - Get safety equipment for a vehicle
  app.get("/api/v1/planning/vehicles/:id/safety-equipment", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.query(
        'SELECT * FROM cc_vehicle_safety_equipment WHERE vehicle_id = $1',
        [id]
      );
      res.json({ equipment: result.rows });
    } catch (error) {
      console.error('Error fetching vehicle equipment:', error);
      res.status(500).json({ error: 'Failed to fetch vehicle equipment' });
    }
  });

  // PUT /api/v1/planning/vehicles/:vehicleId/safety-equipment/:equipmentTypeId - Update safety equipment
  app.put("/api/v1/planning/vehicles/:vehicleId/safety-equipment/:equipmentTypeId", async (req, res) => {
    try {
      const { vehicleId, equipmentTypeId } = req.params;
      const { present, condition, notes } = req.body;

      const result = await storage.query(`
        INSERT INTO cc_vehicle_safety_equipment (vehicle_id, equipment_type_id, present, condition, notes, last_checked)
        VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
        ON CONFLICT (vehicle_id, equipment_type_id)
        DO UPDATE SET present = $3, condition = $4, notes = $5, last_checked = CURRENT_DATE
        RETURNING *
      `, [vehicleId, equipmentTypeId, present, condition || null, notes || null]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating equipment:', error);
      res.status(500).json({ error: 'Failed to update equipment' });
    }
  });

  return httpServer;
}
