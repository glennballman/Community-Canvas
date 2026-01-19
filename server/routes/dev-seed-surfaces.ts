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
  ccSurfaceUtilityBindings,
  ccCapacityPolicies
} from '@shared/schema';
import { sql } from 'drizzle-orm';
import { getEffectiveUnits, compareCapacityLenses } from '../lib/surfaces/capacityLens';

const router = Router();

const TEST_PORTAL_ID = '00000000-0000-0000-0000-000000000001';
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

router.post('/surfaces', async (_req, res) => {
  try {
    console.log('[Surface Seed] Starting V3.5 Surface Spine seed...');

    // Clear existing data
    await db.execute(sql`DELETE FROM cc_capacity_policies WHERE portal_id = ${TEST_PORTAL_ID}`);
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
    // SEED 6: MARINA DOCK SEGMENTS (92,354mm linear moorage)
    // Per Patent CC-02 - Inventor: Glenn Ballman
    // =============================================
    console.log('[Surface Seed] Creating Marina dock segments...');

    const [marinaContainer] = await db.insert(ccSurfaceContainers).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerType: 'marina',
      title: 'Woods End Marina',
      sortOrder: 1,
    }).returning();

    // 5 Dock Segments with linear moorage dimensions
    const dockSegmentDefs = [
      { title: 'Dock A - North', linearMm: 24384 }, // 80 ft
      { title: 'Dock A - South', linearMm: 24384 }, // 80 ft
      { title: 'Dock B - Main', linearMm: 18288 },  // 60 ft
      { title: 'Dock C - Visitor', linearMm: 15240 }, // 50 ft
      { title: 'Dock D - Fuel Pier', linearMm: 10058 }, // 33 ft
    ];

    let totalLinearMm = 0;
    const dockSegmentIds: string[] = [];

    for (let idx = 0; idx < dockSegmentDefs.length; idx++) {
      const def = dockSegmentDefs[idx];
      const [segment] = await db.insert(ccSurfaceContainers).values({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        parentContainerId: marinaContainer.id,
        containerType: 'dock_segment',
        title: def.title,
        sortOrder: idx + 1,
      }).returning();
      
      dockSegmentIds.push(segment.id);

      const [segmentSurface] = await db.insert(ccSurfaces).values({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        surfaceType: 'stand',
        title: `${def.title} Moorage`,
        linearMm: def.linearMm,
        metadata: { segment_type: 'moorage_edge' },
      }).returning();

      await db.insert(ccSurfaceContainerMembers).values({
        portalId: TEST_PORTAL_ID,
        tenantId: TEST_TENANT_ID,
        containerId: segment.id,
        surfaceId: segmentSurface.id,
      });

      // Each segment has moorage units based on 6m slip average
      const slipCount = Math.floor(def.linearMm / 6000);
      await db.insert(ccSurfaceUnits).values(
        Array.from({ length: slipCount }, (_, i) => ({
          portalId: TEST_PORTAL_ID,
          tenantId: TEST_TENANT_ID,
          surfaceId: segmentSurface.id,
          unitType: 'stand',
          unitIndex: i + 1,
          label: `${def.title.split(' ')[1]}-${i + 1}`,
          unitTags: ['moorage'],
        }))
      );

      totalLinearMm += def.linearMm;
    }

    console.log(`[Surface Seed] Marina total linear moorage: ${totalLinearMm}mm (expected: 92354mm)`);

    // =============================================
    // SEED 7: CAPACITY POLICIES (Normal vs Emergency)
    // Per Patent CC-02 - Inventor: Glenn Ballman
    // =============================================
    console.log('[Surface Seed] Creating Capacity Policies...');

    // =============================================
    // CAPACITY POLICIES (Lens CAPS - limits, not overrides)
    // A cap limits offerable units: lensUnitsTotal = min(physical, cap)
    // =============================================
    
    // Aviator Cottage: no caps needed (physical=19 is available in both lenses)
    // Not inserting policy - defaults to physical for both lenses

    // Canoe 1: normal cap=3 (limit rentals), emergency=full physical (all available in emergency)
    await db.insert(ccCapacityPolicies).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerId: canoe1Container.id,
      surfaceType: 'sit',
      normalUnitsLimit: 3,           // limit to 3 seats in normal operations
      closedInEmergency: false,      // emergency: full physical capacity available
      metadata: { notes: 'Normal: limit rentals. Emergency: all seats available' },
    });

    // Canoe 2: same as Canoe 1
    await db.insert(ccCapacityPolicies).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerId: canoe2Container.id,
      surfaceType: 'sit',
      normalUnitsLimit: 3,
      closedInEmergency: false,      // emergency: full physical capacity available
      metadata: { notes: 'Normal: limit rentals. Emergency: all seats available' },
    });

    // Kayak 1: normal cap=1 (limit rentals), emergency=full physical
    await db.insert(ccCapacityPolicies).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerId: kayak1Container.id,
      surfaceType: 'sit',
      normalUnitsLimit: 1,           // limit to 1 seat in normal operations
      closedInEmergency: false,      // emergency: full physical capacity available
      metadata: { notes: 'Normal: limit rentals. Emergency: all seats available' },
    });

    // Bike Corral: normal cap=12 (staff reserve 4 of 16)
    await db.insert(ccCapacityPolicies).values({
      portalId: TEST_PORTAL_ID,
      tenantId: TEST_TENANT_ID,
      containerId: bikeCorralContainer.id,
      surfaceType: 'stand',
      normalUnitsLimit: 12,          // cap at 12 (16 physical - 4 staff reserve)
      closedInEmergency: false,      // bikes available in emergency (full physical capacity)
      metadata: { notes: 'Normal: 4 spots reserved for staff' },
    });

    // Flora's Restaurant: no caps needed (physical=10 available in both lenses)
    // Not inserting policy - defaults to physical for both lenses

    // Marina: no caps needed (physical=14 slips available in both lenses)
    // Not inserting policy - defaults to physical for both lenses

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

    const marinaMoorage = await db.execute<{ sum: string }>(sql`
      SELECT COALESCE(SUM(linear_mm), 0) as sum
      FROM cc_surfaces 
      WHERE portal_id = ${TEST_PORTAL_ID}
        AND title LIKE '%Moorage%'
        AND metadata->>'segment_type' = 'moorage_edge'
    `);

    const capacityPolicies = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count
      FROM cc_capacity_policies
      WHERE portal_id = ${TEST_PORTAL_ID}
    `);

    const proofResults = {
      aviator_sleep_units: parseInt(aviatorSleepUnits.rows?.[0]?.count || '0'),
      flora_seats: parseInt(floraSeats.rows?.[0]?.count || '0'),
      bike_spots: parseInt(bikeSpots.rows?.[0]?.count || '0'),
      dock_slips: parseInt(dockSlips.rows?.[0]?.count || '0'),
      utility_bindings: parseInt(utilityBindings.rows?.[0]?.count || '0'),
      marina_linear_mm: parseInt(marinaMoorage.rows?.[0]?.sum || '0'),
      capacity_policies: parseInt(capacityPolicies.rows?.[0]?.count || '0'),
    };

    console.log('[Surface Seed] Proof results:', proofResults);
    console.log('[Surface Seed] Expected: aviator=19, flora=10, bikes=16, slips=9, bindings=9, marina=92354mm, policies=7');

    res.json({
      ok: true,
      message: 'V3.5 Surface Spine seed completed with Capacity Lenses',
      proof: proofResults,
      expected: {
        aviator_sleep_units: 19,
        flora_seats: 10,
        bike_spots: 16,
        dock_slips: 9,
        utility_bindings: 9,
        marina_linear_mm: 92354,
        capacity_policies: 4, // 4 policies: Canoe 1, Canoe 2, Kayak 1, Bike Corral
      },
      containers: {
        aviator: aviatorCottage.id,
        bikeCorral: bikeCorralContainer.id,
        flora: floraRestaurant.id,
        woodsEndDock: woodsEndDock.id,
        dockRamp: dockRampContainer.id,
        boardwalk: boardwalkContainer.id,
        marina: marinaContainer.id,
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

// GET /surfaces/capacity-proof - Run capacity lens proof scenarios
router.get('/surfaces/capacity-proof', async (req, res) => {
  try {
    console.log('[Capacity Proof] Running capacity lens proof scenarios...');

    // Get containers for testing
    const containers = await db.execute<{
      id: string;
      title: string;
      container_type: string;
    }>(sql`
      SELECT id, title, container_type
      FROM cc_surface_containers
      WHERE portal_id = ${TEST_PORTAL_ID}
        AND parent_container_id IS NULL
      ORDER BY title
    `);

    const proofs: Record<string, any> = {};

    for (const container of containers.rows) {
      // Get surface types for this container (using recursive CTE for descendants)
      const surfaceTypesResult = await db.execute<{ surface_type: string }>(sql`
        WITH RECURSIVE container_tree AS (
          SELECT id FROM cc_surface_containers WHERE id = ${container.id}
          UNION ALL
          SELECT c.id 
          FROM cc_surface_containers c
          JOIN container_tree ct ON c.parent_container_id = ct.id
        )
        SELECT DISTINCT su.unit_type as surface_type
        FROM cc_surface_units su
        JOIN cc_surfaces s ON s.id = su.surface_id
        JOIN cc_surface_container_members scm ON scm.surface_id = s.id
        JOIN container_tree ct ON scm.container_id = ct.id
      `);

      for (const stRow of surfaceTypesResult.rows) {
        const comparison = await compareCapacityLenses(
          TEST_PORTAL_ID,
          container.id,
          stRow.surface_type
        );

        const key = `${container.title}_${stRow.surface_type}`;
        proofs[key] = {
          container: container.title,
          containerType: container.container_type,
          surfaceType: stRow.surface_type,
          physicalUnitsTotal: comparison.physicalUnitsTotal,
          normal: {
            lensCap: comparison.normal.lensCap,
            lensUnitsTotal: comparison.normal.lensUnitsTotal,
            hasPolicy: comparison.normal.lensCap !== null,
          },
          emergency: {
            lensCap: comparison.emergency.lensCap,
            lensUnitsTotal: comparison.emergency.lensUnitsTotal,
            hasPolicy: comparison.emergency.lensCap !== null,
            closedInEmergency: comparison.emergency.closedInEmergency,
          },
          invariantViolation: comparison.invariantViolation,
          invariantMessage: comparison.invariantMessage,
        };
      }
    }

    // Expected proof results with CAP semantics:
    // physical = actual units, normal/emergency = min(physical, cap) or physical if no cap
    // Cap semantics: offerable = min(physical, cap_if_set)
    // Emergency = full physical (everything available in real emergencies)
    const expected = {
      // Aviator: physical=19, no caps → normal=19, emergency=19
      'Aviator_sleep': { physical: 19, normal: 19, emergency: 19 },
      // Bike Corral: physical=16, normal cap=12 → normal=12, emergency=16 (full in emergency)
      'Bike Corral Stall_stand': { physical: 16, normal: 12, emergency: 16 },
      // Flora's: physical=10, no caps → normal=10, emergency=10
      "Flora's_sit": { physical: 10, normal: 10, emergency: 10 },
      // Canoe 1: physical=6, normal cap=3 → normal=3, emergency=6 (full physical in emergency)
      'Canoe 1_sit': { physical: 6, normal: 3, emergency: 6 },
      // Canoe 2: physical=6, normal cap=3 → normal=3, emergency=6 (full physical in emergency)
      'Canoe 2_sit': { physical: 6, normal: 3, emergency: 6 },
      // Kayak 1: physical=2, normal cap=1 → normal=1, emergency=2 (full physical in emergency)
      'Kayak 1_sit': { physical: 2, normal: 1, emergency: 2 },
      // Marina: physical=14, no caps → normal=14, emergency=14
      'Woods End Marina_stand': { physical: 14, normal: 14, emergency: 14 },
    };

    // Validate proofs
    const passed: string[] = [];
    const failed: string[] = [];

    for (const [key, exp] of Object.entries(expected)) {
      const actual = proofs[key];
      if (!actual) {
        failed.push(`${key}: NOT FOUND`);
        continue;
      }

      if (
        actual.physicalUnitsTotal === exp.physical &&
        actual.normal.lensUnitsTotal === exp.normal &&
        actual.emergency.lensUnitsTotal === exp.emergency
      ) {
        passed.push(key);
      } else {
        failed.push(`${key}: expected physical=${exp.physical}, normal=${exp.normal}, emergency=${exp.emergency} but got physical=${actual.physicalUnitsTotal}, normal=${actual.normal.lensUnitsTotal}, emergency=${actual.emergency.lensUnitsTotal}`);
      }
    }

    console.log(`[Capacity Proof] Passed: ${passed.length}/${Object.keys(expected).length}`);
    if (failed.length > 0) {
      console.log('[Capacity Proof] Failed:', failed);
    }

    res.json({
      ok: failed.length === 0,
      message: failed.length === 0 
        ? 'All capacity lens proofs passed' 
        : `${failed.length} proofs failed`,
      passed: passed.length,
      total: Object.keys(expected).length,
      proofs,
      expected,
      failed,
    });
  } catch (err) {
    console.error('[Capacity Proof] Error:', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
