/**
 * PATENT CC-02 SURFACES PATENT INVENTOR GLENN BALLMAN
 * Dev Seed for V3.5 Surface Spine
 * 
 * Creates test data for:
 * - Aviator cottage (19 sleep units)
 * - Bike Corral (16 stand units)
 * - Flora's Restaurant (10 sit units)
 * - Watercraft: 2 Canoes + 1 Kayak (14 sit units)
 * - Woods End Dock (9 slips with shared power)
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  ccSurfaceContainers,
  ccSurfaces,
  ccSurfaceContainerMembers,
  ccSurfaceUnits,
  ccUtilityNodes,
  ccSurfaceUtilityBindings
} from '@shared/schema';
import { sql } from 'drizzle-orm';

const router = Router();

const TEST_PORTAL_ID = '00000000-0000-0000-0000-000000000001';
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

router.post('/surfaces', async (_req, res) => {
  try {
    console.log('[Surface Seed] Starting V3.5 Surface Spine seed...');

    // Clear existing data
    await db.execute(sql`DELETE FROM cc_surface_utility_bindings WHERE portal_id = ${TEST_PORTAL_ID}`);
    await db.execute(sql`DELETE FROM cc_utility_nodes WHERE portal_id = ${TEST_PORTAL_ID}`);
    await db.execute(sql`DELETE FROM cc_surface_units WHERE portal_id = ${TEST_PORTAL_ID}`);
    await db.execute(sql`DELETE FROM cc_surface_container_members WHERE portal_id = ${TEST_PORTAL_ID}`);
    await db.execute(sql`DELETE FROM cc_surfaces WHERE portal_id = ${TEST_PORTAL_ID}`);
    await db.execute(sql`DELETE FROM cc_surface_containers WHERE portal_id = ${TEST_PORTAL_ID}`);

    // =============================================
    // SEED 1: AVIATOR COTTAGE (19 sleep units)
    // =============================================
    console.log('[Surface Seed] Creating Aviator cottage...');

    const [aviatorCottage] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerType: 'cottage',
      title: 'Aviator',
      isPrivate: false,
      sortOrder: 1,
    }).returning();

    const [aviatorBedroom] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      parentContainerId: aviatorCottage.id,
      containerType: 'room',
      title: 'Bedroom',
      isPrivate: true,
      sortOrder: 1,
    }).returning();

    const [aviatorLiving] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      parentContainerId: aviatorCottage.id,
      containerType: 'room',
      title: 'Living Room',
      isPrivate: false,
      sortOrder: 2,
    }).returning();

    // Bed objects in bedroom
    const [topBunkObj] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      parentContainerId: aviatorBedroom.id,
      containerType: 'bed_object',
      title: 'Top Bunk',
      sortOrder: 1,
    }).returning();

    const [bottomBunkObj] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      parentContainerId: aviatorBedroom.id,
      containerType: 'bed_object',
      title: 'Bottom Bunk',
      sortOrder: 2,
    }).returning();

    // Bed objects in living room
    const [sofaBedObj] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      parentContainerId: aviatorLiving.id,
      containerType: 'bed_object',
      title: 'Sofa Bed',
      sortOrder: 1,
    }).returning();

    const [floorZoneObj] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      parentContainerId: aviatorLiving.id,
      containerType: 'bed_object',
      title: 'Floor Zone',
      sortOrder: 2,
    }).returning();

    // Create physical surfaces
    const [topBunkSurface] = await db.insert(ccSurfaces).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      surfaceType: 'sleep',
      title: 'Top Bunk Mattress',
      widthMm: 1900,
      lengthMm: 2000,
    }).returning();

    const [bottomBunkSurface] = await db.insert(ccSurfaces).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      surfaceType: 'sleep',
      title: 'Bottom Bunk Mattress',
      widthMm: 2100,
      lengthMm: 2000,
    }).returning();

    const [sofaBedSurface] = await db.insert(ccSurfaces).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      surfaceType: 'sleep',
      title: 'Sofa Bed Mattress',
      widthMm: 2100,
      lengthMm: 1800,
    }).returning();

    const [floorZoneSurface] = await db.insert(ccSurfaces).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      surfaceType: 'sleep',
      title: 'Floor Zone Sleep Area',
      widthMm: 3000,
      lengthMm: 3000,
    }).returning();

    // Map surfaces to containers
    await db.insert(ccSurfaceContainerMembers).values([
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, containerId: topBunkObj.id, surfaceId: topBunkSurface.id },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, containerId: bottomBunkObj.id, surfaceId: bottomBunkSurface.id },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, containerId: sofaBedObj.id, surfaceId: sofaBedSurface.id },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, containerId: floorZoneObj.id, surfaceId: floorZoneSurface.id },
    ]);

    // Create atomic units - 19 total (4 + 5 + 5 + 5)
    // Top Bunk: 4 units
    await db.insert(ccSurfaceUnits).values(
      Array.from({ length: 4 }, (_, i) => ({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceId: topBunkSurface.id,
        unitType: 'sleep',
        unitIndex: i + 1,
        label: `TopBunk-${i + 1}`,
        unitMaxLbs: 300,
        unitTags: ['top_bunk', 'needs_ladder'],
      }))
    );

    // Bottom Bunk: 5 units
    await db.insert(ccSurfaceUnits).values(
      Array.from({ length: 5 }, (_, i) => ({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceId: bottomBunkSurface.id,
        unitType: 'sleep',
        unitIndex: i + 1,
        label: `BottomBunk-${i + 1}`,
        unitTags: ['bottom_bunk', 'floor_level'],
      }))
    );

    // Sofa Bed: 5 units
    await db.insert(ccSurfaceUnits).values(
      Array.from({ length: 5 }, (_, i) => ({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceId: sofaBedSurface.id,
        unitType: 'sleep',
        unitIndex: i + 1,
        label: `SofaBed-${i + 1}`,
        unitTags: ['sofa_bed'],
      }))
    );

    // Floor Zone: 5 units
    await db.insert(ccSurfaceUnits).values(
      Array.from({ length: 5 }, (_, i) => ({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceId: floorZoneSurface.id,
        unitType: 'sleep',
        unitIndex: i + 1,
        label: `Floor-${i + 1}`,
        unitTags: ['floor_mattress', 'floor_level'],
      }))
    );

    // =============================================
    // SEED 2: BIKE CORRAL (16 stand units)
    // =============================================
    console.log('[Surface Seed] Creating Bike Corral...');

    const [bikeCorralContainer] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerType: 'parking_stall',
      title: 'Bike Corral Stall',
      sortOrder: 1,
    }).returning();

    const [bikeStallSurface] = await db.insert(ccSurfaces).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      surfaceType: 'stand',
      title: 'Stall Footprint',
      widthMm: 5000,
      lengthMm: 3000,
    }).returning();

    await db.insert(ccSurfaceContainerMembers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerId: bikeCorralContainer.id,
      surfaceId: bikeStallSurface.id,
    });

    await db.insert(ccSurfaceUnits).values(
      Array.from({ length: 16 }, (_, i) => ({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceId: bikeStallSurface.id,
        unitType: 'stand',
        unitIndex: i + 1,
        label: `Bike-${i + 1}`,
        unitTags: ['bike_spot'],
      }))
    );

    // =============================================
    // SEED 3: FLORA'S RESTAURANT (10 sit units)
    // =============================================
    console.log("[Surface Seed] Creating Flora's Restaurant...");

    const [floraRestaurant] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerType: 'restaurant',
      title: "Flora's",
      sortOrder: 1,
    }).returning();

    const [floraTable] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      parentContainerId: floraRestaurant.id,
      containerType: 'table',
      title: 'Table-10Top',
      sortOrder: 1,
    }).returning();

    const [floraTableSurface] = await db.insert(ccSurfaces).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      surfaceType: 'sit',
      title: 'Table 10 Seating',
    }).returning();

    await db.insert(ccSurfaceContainerMembers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerId: floraTable.id,
      surfaceId: floraTableSurface.id,
    });

    await db.insert(ccSurfaceUnits).values(
      Array.from({ length: 10 }, (_, i) => ({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceId: floraTableSurface.id,
        unitType: 'sit',
        unitIndex: i + 1,
        label: `Seat-${i + 1}`,
      }))
    );

    // =============================================
    // SEED 4: WATERCRAFT (14 sit units)
    // =============================================
    console.log('[Surface Seed] Creating Watercraft...');

    // Canoe 1 - 6 seats
    const [canoe1Container] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerType: 'watercraft',
      title: 'Canoe 1',
      sortOrder: 1,
    }).returning();

    const [canoe1Surface] = await db.insert(ccSurfaces).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      surfaceType: 'sit',
      title: 'Canoe 1 Hull',
      lengthMm: 5000,
      metadata: { watercraft_type: 'canoe' },
    }).returning();

    await db.insert(ccSurfaceContainerMembers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerId: canoe1Container.id,
      surfaceId: canoe1Surface.id,
    });

    await db.insert(ccSurfaceUnits).values([
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe1Surface.id, unitType: 'sit', unitIndex: 1, label: 'Canoe1-Bow' },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe1Surface.id, unitType: 'sit', unitIndex: 2, label: 'Canoe1-Mid1' },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe1Surface.id, unitType: 'sit', unitIndex: 3, label: 'Canoe1-Mid2' },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe1Surface.id, unitType: 'sit', unitIndex: 4, label: 'Canoe1-Mid3' },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe1Surface.id, unitType: 'sit', unitIndex: 5, label: 'Canoe1-Mid4' },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe1Surface.id, unitType: 'sit', unitIndex: 6, label: 'Canoe1-Stern' },
    ]);

    // Canoe 2 - 6 seats
    const [canoe2Container] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerType: 'watercraft',
      title: 'Canoe 2',
      sortOrder: 2,
    }).returning();

    const [canoe2Surface] = await db.insert(ccSurfaces).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      surfaceType: 'sit',
      title: 'Canoe 2 Hull',
      lengthMm: 5000,
    }).returning();

    await db.insert(ccSurfaceContainerMembers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerId: canoe2Container.id,
      surfaceId: canoe2Surface.id,
    });

    await db.insert(ccSurfaceUnits).values([
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe2Surface.id, unitType: 'sit', unitIndex: 1, label: 'Canoe2-Bow' },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe2Surface.id, unitType: 'sit', unitIndex: 2, label: 'Canoe2-Mid1' },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe2Surface.id, unitType: 'sit', unitIndex: 3, label: 'Canoe2-Mid2' },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe2Surface.id, unitType: 'sit', unitIndex: 4, label: 'Canoe2-Mid3' },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe2Surface.id, unitType: 'sit', unitIndex: 5, label: 'Canoe2-Mid4' },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: canoe2Surface.id, unitType: 'sit', unitIndex: 6, label: 'Canoe2-Stern' },
    ]);

    // Kayak 1 - 2 seats
    const [kayak1Container] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerType: 'watercraft',
      title: 'Kayak 1',
      sortOrder: 3,
    }).returning();

    const [kayak1Surface] = await db.insert(ccSurfaces).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      surfaceType: 'sit',
      title: 'Kayak 1 Hull',
      lengthMm: 3500,
      metadata: { watercraft_type: 'kayak' },
    }).returning();

    await db.insert(ccSurfaceContainerMembers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerId: kayak1Container.id,
      surfaceId: kayak1Surface.id,
    });

    await db.insert(ccSurfaceUnits).values([
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: kayak1Surface.id, unitType: 'sit', unitIndex: 1, label: 'Kayak1-Front' },
      { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: kayak1Surface.id, unitType: 'sit', unitIndex: 2, label: 'Kayak1-Rear' },
    ]);

    // =============================================
    // SEED 5: WOODS END DOCK (9 slips + shared power)
    // =============================================
    console.log('[Surface Seed] Creating Woods End Dock...');

    const [woodsEndDock] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerType: 'dock',
      title: 'Woods End Dock',
      sortOrder: 1,
    }).returning();

    const [mainFloat] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      parentContainerId: woodsEndDock.id,
      containerType: 'dock_section',
      title: 'Main Float',
      sortOrder: 1,
    }).returning();

    const [fingerB] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      parentContainerId: woodsEndDock.id,
      containerType: 'dock_section',
      title: 'Finger B',
      sortOrder: 2,
    }).returning();

    // Create dock ramp (tide-sensitive movement surface)
    const [dockRampContainer] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      parentContainerId: woodsEndDock.id,
      containerType: 'dock_section',
      title: 'Dock Ramp',
      sortOrder: 0,
    }).returning();

    const [dockRampSurface] = await db.insert(ccSurfaces).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      surfaceType: 'movement',
      title: 'Dock Ramp Surface',
      linearMm: 5000,
      metadata: {
        ramp_slope_at_low_tide_pct: 18,
        ramp_slope_at_high_tide_pct: 2,
        low_tide_height_m: 0.5,
        high_tide_height_m: 3.0,
        min_clear_width_mm: 1200,
        has_grates: false,
      },
    }).returning();

    await db.insert(ccSurfaceContainerMembers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerId: dockRampContainer.id,
      surfaceId: dockRampSurface.id,
    });

    // Create boardwalk (grated movement surface)
    const [boardwalkContainer] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      parentContainerId: woodsEndDock.id,
      containerType: 'dock_section',
      title: 'Boardwalk',
      sortOrder: 0,
    }).returning();

    const [boardwalkSurface] = await db.insert(ccSurfaces).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      surfaceType: 'movement',
      title: 'Boardwalk Grated',
      linearMm: 8000,
      metadata: {
        has_grates: true,
        min_clear_width_mm: 1500,
      },
    }).returning();

    await db.insert(ccSurfaceContainerMembers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerId: boardwalkContainer.id,
      surfaceId: boardwalkSurface.id,
    });

    // Create shared power pool
    const [dockPowerPool] = await db.insert(ccUtilityNodes).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      nodeType: 'shared_pool',
      utilityType: 'electricity',
      title: 'Dock Power Shared Pool',
      capacity: { max_watts: 3000 },
    }).returning();

    // Create slips for Main Float (A1-A5)
    const mainFloatSlipIds = ['A1', 'A2', 'A3', 'A4', 'A5'];
    const utilitySurfaceIds: string[] = [];

    for (const slipId of mainFloatSlipIds) {
      const [slipContainer] = await db.insert(ccSurfaceContainers).values({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        parentContainerId: mainFloat.id,
        containerType: 'slip',
        title: `Slip ${slipId}`,
        sortOrder: mainFloatSlipIds.indexOf(slipId) + 1,
      }).returning();

      // Stand surface (moorage edge)
      const [moorageSurface] = await db.insert(ccSurfaces).values({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceType: 'stand',
        title: `Slip ${slipId} Moorage Edge`,
        linearMm: 6000,
      }).returning();

      // Utility surface (power outlet)
      const [powerSurface] = await db.insert(ccSurfaces).values({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceType: 'utility',
        title: `Slip ${slipId} Power Outlet`,
        utilityType: 'electricity',
        utilityConnector: 'standard_120v',
      }).returning();

      utilitySurfaceIds.push(powerSurface.id);

      await db.insert(ccSurfaceContainerMembers).values([
        { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, containerId: slipContainer.id, surfaceId: moorageSurface.id },
        { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, containerId: slipContainer.id, surfaceId: powerSurface.id },
      ]);

      // Atomic units
      await db.insert(ccSurfaceUnits).values([
        { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: moorageSurface.id, unitType: 'stand', unitIndex: 1, label: `SlipMoorage-${slipId}` },
        { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: powerSurface.id, unitType: 'utility', unitIndex: 1, label: `SlipPower-${slipId}` },
      ]);
    }

    // Create slips for Finger B (B1-B4)
    const fingerBSlipIds = ['B1', 'B2', 'B3', 'B4'];

    for (const slipId of fingerBSlipIds) {
      const [slipContainer] = await db.insert(ccSurfaceContainers).values({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        parentContainerId: fingerB.id,
        containerType: 'slip',
        title: `Slip ${slipId}`,
        sortOrder: fingerBSlipIds.indexOf(slipId) + 1,
      }).returning();

      const [moorageSurface] = await db.insert(ccSurfaces).values({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceType: 'stand',
        title: `Slip ${slipId} Moorage Edge`,
        linearMm: 6000,
      }).returning();

      const [powerSurface] = await db.insert(ccSurfaces).values({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceType: 'utility',
        title: `Slip ${slipId} Power Outlet`,
        utilityType: 'electricity',
        utilityConnector: 'standard_120v',
      }).returning();

      utilitySurfaceIds.push(powerSurface.id);

      await db.insert(ccSurfaceContainerMembers).values([
        { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, containerId: slipContainer.id, surfaceId: moorageSurface.id },
        { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, containerId: slipContainer.id, surfaceId: powerSurface.id },
      ]);

      await db.insert(ccSurfaceUnits).values([
        { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: moorageSurface.id, unitType: 'stand', unitIndex: 1, label: `SlipMoorage-${slipId}` },
        { portalId: TEST_PORTAL_ID, tenantId: TEST_TENANT_ID, surfaceId: powerSurface.id, unitType: 'utility', unitIndex: 1, label: `SlipPower-${slipId}` },
      ]);
    }

    // Bind all utility surfaces to shared power pool
    await db.insert(ccSurfaceUtilityBindings).values(
      utilitySurfaceIds.map(surfaceId => ({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceId,
        utilityNodeId: dockPowerPool.id,
        priority: 0,
      }))
    );

    // =============================================
    // PROOF QUERIES
    // =============================================
    console.log('[Surface Seed] Running proof queries...');

    const aviatorSleepUnits = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count
      FROM cc_surface_units su
      JOIN cc_surfaces s ON su.surface_id = s.id
      JOIN cc_surface_container_members scm ON s.id = scm.surface_id
      JOIN cc_surface_containers c ON scm.container_id = c.id
      WHERE c.portal_id = ${TEST_PORTAL_ID}
        AND su.unit_type = 'sleep'
    `);

    const floraSeats = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count
      FROM cc_surface_units 
      WHERE unit_type = 'sit' 
        AND portal_id = ${TEST_PORTAL_ID}
        AND surface_id IN (SELECT id FROM cc_surfaces WHERE title LIKE '%Table 10%')
    `);

    const bikeSpots = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count
      FROM cc_surface_units 
      WHERE unit_type = 'stand'
        AND portal_id = ${TEST_PORTAL_ID}
        AND surface_id IN (SELECT id FROM cc_surfaces WHERE title LIKE '%Stall%')
    `);

    const dockSlips = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count
      FROM cc_surface_containers 
      WHERE container_type = 'slip'
        AND portal_id = ${TEST_PORTAL_ID}
    `);

    const utilityBindings = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count
      FROM cc_surface_utility_bindings
      WHERE portal_id = ${TEST_PORTAL_ID}
    `);

    const proofResults = {
      aviator_sleep_units: parseInt(aviatorSleepUnits.rows?.[0]?.count || '0'),
      flora_seats: parseInt(floraSeats.rows?.[0]?.count || '0'),
      bike_spots: parseInt(bikeSpots.rows?.[0]?.count || '0'),
      dock_slips: parseInt(dockSlips.rows?.[0]?.count || '0'),
      utility_bindings: parseInt(utilityBindings.rows?.[0]?.count || '0'),
    };

    console.log('[Surface Seed] Proof results:', proofResults);
    console.log('[Surface Seed] Expected: aviator=19, flora=10, bikes=16, slips=9, bindings=9');

    res.json({
      ok: true,
      message: 'V3.5 Surface Spine seed completed',
      proof: proofResults,
      expected: {
        aviator_sleep_units: 19,
        flora_seats: 10,
        bike_spots: 16,
        dock_slips: 9,
        utility_bindings: 9,
      },
      containers: {
        aviator: aviatorCottage.id,
        bikeCorral: bikeCorralContainer.id,
        flora: floraRestaurant.id,
        woodsEndDock: woodsEndDock.id,
        dockRamp: dockRampContainer.id,
        boardwalk: boardwalkContainer.id,
      },
      surfaces: {
        dockRamp: dockRampSurface.id,
        boardwalk: boardwalkSurface.id,
        canoe1: canoe1Surface.id,
        kayak1: kayak1Surface.id,
      },
      utilityNodes: {
        dockPowerPool: dockPowerPool.id,
      },
    });
  } catch (err) {
    console.error('[Surface Seed] Error:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
