/**
 * N3 Dev Seed Route
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Creates test data for the N3 Service Run Monitor + Replan Engine:
 * - Sample service run with segments
 * - Tide predictions for Bamfield
 * - Weather normals for coastal BC
 * - Triggers evaluation to create replan bundle
 */

import { Router } from 'express';
import { db } from '../db';
import { 
  ccN3Runs, 
  ccN3Segments, 
  ccTidePredictions, 
  ccWeatherNormals,
  ccN3SurfaceRequirements,
  ccSurfaces,
  ccSurfaceUtilityBindings,
} from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { evaluateServiceRun, saveEvaluationResult } from '../lib/n3';

const router = Router();

const BAMFIELD_LOCATION = 'bamfield-bc';
const TEST_PORTAL_ID = '00000000-0000-0000-0000-000000000001';
const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

function generateTidePredictions(locationRef: string, startDate: Date, days: number) {
  const predictions: Array<{
    locationRef: string;
    ts: Date;
    heightM: string;
  }> = [];

  const tideCycle = 12.4166667 * 60 * 60 * 1000;
  const amplitude = 1.5;
  const meanLevel = 2.5;
  
  for (let day = 0; day < days; day++) {
    for (let hour = 0; hour < 24; hour += 0.5) {
      const ts = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000);
      const phase = (ts.getTime() / tideCycle) * 2 * Math.PI;
      const height = meanLevel + amplitude * Math.sin(phase);
      
      predictions.push({
        locationRef,
        ts,
        heightM: height.toFixed(3),
      });
    }
  }

  return predictions;
}

function generateWeatherNormals(locationRef: string) {
  const normals: Array<{
    locationRef: string;
    dayOfYear: number;
    tempLowC: string;
    tempHighC: string;
    rainProb: string;
    fogProb: string;
    windProb: string;
  }> = [];

  for (let doy = 1; doy <= 365; doy++) {
    const isWinter = doy < 90 || doy > 300;
    const isSummer = doy >= 150 && doy <= 240;
    
    const tempLow = isWinter ? -2 + Math.random() * 5 : isSummer ? 10 + Math.random() * 5 : 5 + Math.random() * 5;
    const tempHigh = isWinter ? 5 + Math.random() * 5 : isSummer ? 20 + Math.random() * 8 : 12 + Math.random() * 6;
    const rainProb = isWinter ? 0.6 + Math.random() * 0.3 : isSummer ? 0.1 + Math.random() * 0.2 : 0.3 + Math.random() * 0.3;
    const fogProb = isSummer ? 0.3 + Math.random() * 0.2 : 0.15 + Math.random() * 0.15;
    const windProb = isWinter ? 0.4 + Math.random() * 0.3 : 0.2 + Math.random() * 0.2;

    normals.push({
      locationRef,
      dayOfYear: doy,
      tempLowC: tempLow.toFixed(2),
      tempHighC: tempHigh.toFixed(2),
      rainProb: rainProb.toFixed(3),
      fogProb: fogProb.toFixed(3),
      windProb: windProb.toFixed(3),
    });
  }

  return normals;
}

router.post('/n3', async (req, res) => {
  try {
    console.log('[N3 Seed] Starting N3 dev seed...');

    const now = new Date();
    const runStartTime = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    const runEndTime = new Date(runStartTime.getTime() + 8 * 60 * 60 * 1000);

    const [run] = await db.insert(ccN3Runs).values({
      tenantId: TEST_TENANT_ID,
      name: 'Bamfield Marine Expedition',
      description: 'Test service run for N3 monitor evaluation - includes boat loading, transit, and work segments',
      status: 'scheduled',
      startsAt: runStartTime,
      endsAt: runEndTime,
      metadata: {
        testRun: true,
        location: BAMFIELD_LOCATION,
        createdBy: 'dev-seed',
      },
    }).returning();

    console.log(`[N3 Seed] Created run: ${run.id}`);

    const loadStartTime = new Date(runStartTime.getTime());
    const loadEndTime = new Date(loadStartTime.getTime() + 45 * 60 * 1000);
    
    const transitStartTime = new Date(loadEndTime.getTime() + 15 * 60 * 1000);
    const transitEndTime = new Date(transitStartTime.getTime() + 2 * 60 * 60 * 1000);
    
    const workStartTime = new Date(transitEndTime.getTime() + 30 * 60 * 1000);
    const workEndTime = new Date(workStartTime.getTime() + 4 * 60 * 60 * 1000);
    
    const returnStartTime = new Date(workEndTime.getTime() + 30 * 60 * 1000);
    const returnEndTime = new Date(returnStartTime.getTime() + 2 * 60 * 60 * 1000);

    const segments = await db.insert(ccN3Segments).values([
      {
        tenantId: TEST_TENANT_ID,
        runId: run.id,
        segmentKind: 'load',
        startsAt: loadStartTime,
        endsAt: loadEndTime,
        locationRef: BAMFIELD_LOCATION,
        constraints: { requiresRampAccess: true, minTideHeight: 1.5 },
      },
      {
        tenantId: TEST_TENANT_ID,
        runId: run.id,
        segmentKind: 'ride',
        startsAt: transitStartTime,
        endsAt: transitEndTime,
        locationRef: BAMFIELD_LOCATION,
        constraints: { maxWaveHeight: 1.5, maxWindSpeed: 25 },
      },
      {
        tenantId: TEST_TENANT_ID,
        runId: run.id,
        segmentKind: 'work',
        startsAt: workStartTime,
        endsAt: workEndTime,
        locationRef: 'barkley-sound',
        constraints: { requiresDaylight: true },
      },
      {
        tenantId: TEST_TENANT_ID,
        runId: run.id,
        segmentKind: 'ride',
        startsAt: returnStartTime,
        endsAt: returnEndTime,
        locationRef: BAMFIELD_LOCATION,
        constraints: { maxWaveHeight: 1.5, maxWindSpeed: 25 },
      },
    ]).returning();

    console.log(`[N3 Seed] Created ${segments.length} segments`);

    // =============================================
    // SURFACE REQUIREMENTS (for EffectiveCapacity)
    // =============================================
    console.log('[N3 Seed] Creating surface requirements...');

    // Look up surfaces for requirements (may or may not exist)
    const dockRampSurface = await db.query.ccSurfaces.findFirst({
      where: eq(ccSurfaces.title, 'Dock Ramp Surface'),
    });
    const boardwalkSurface = await db.query.ccSurfaces.findFirst({
      where: eq(ccSurfaces.title, 'Boardwalk Grated'),
    });
    const canoe1Surface = await db.query.ccSurfaces.findFirst({
      where: sql`${ccSurfaces.title} = 'Canoe 1 Hull' AND ${ccSurfaces.portalId} = ${TEST_PORTAL_ID}`,
    });
    const kayak1Surface = await db.query.ccSurfaces.findFirst({
      where: sql`${ccSurfaces.title} = 'Kayak 1 Hull' AND ${ccSurfaces.portalId} = ${TEST_PORTAL_ID}`,
    });

    // Find utility surfaces for power requirements
    const utilitySurfaces = await db.select().from(ccSurfaces).where(
      sql`${ccSurfaces.surfaceType} = 'utility' AND ${ccSurfaces.portalId} = ${TEST_PORTAL_ID}`
    ).limit(3);

    const surfaceRequirements = [];

    // Dock ramp traversal - wheelchair accessible requirement
    if (dockRampSurface) {
      surfaceRequirements.push({
        tenantId: TEST_TENANT_ID,
        portalId: TEST_PORTAL_ID,
        runId: run.id,
        segmentId: segments[0].id, // Transit segment
        surfaceId: dockRampSurface.id,
        requiredSurfaceType: 'movement',
        actorProfile: {
          actor_type: 'wheelchair',
          mass_g: 120000,
          width_mm: 650,
          footprint_mm2: 6500,
          traction: 0.4,
        },
        requiredConstraints: {
          no_grates: true,
          min_clear_width_mm: 900,
          max_slope_pct: 8,
        },
      });
    }

    // Boardwalk traversal - human walking
    if (boardwalkSurface) {
      surfaceRequirements.push({
        tenantId: TEST_TENANT_ID,
        portalId: TEST_PORTAL_ID,
        runId: run.id,
        segmentId: segments[0].id, // Transit segment
        surfaceId: boardwalkSurface.id,
        requiredSurfaceType: 'movement',
        actorProfile: {
          actor_type: 'human',
          mass_g: 80000,
          width_mm: 500,
          traction: 0.6,
        },
        requiredConstraints: {},
      });
    }

    // Canoe usage - sit surface with wind sensitivity
    if (canoe1Surface) {
      surfaceRequirements.push({
        tenantId: TEST_TENANT_ID,
        portalId: TEST_PORTAL_ID,
        runId: run.id,
        segmentId: segments[1].id, // Work segment
        surfaceId: canoe1Surface.id,
        requiredSurfaceType: 'sit',
        demand: {
          sit_units_requested: 4,
          rowing_required: true,
        },
      });
    }

    // Kayak usage - sit surface with wind sensitivity
    if (kayak1Surface) {
      surfaceRequirements.push({
        tenantId: TEST_TENANT_ID,
        portalId: TEST_PORTAL_ID,
        runId: run.id,
        segmentId: segments[1].id, // Work segment
        surfaceId: kayak1Surface.id,
        requiredSurfaceType: 'sit',
        demand: {
          sit_units_requested: 2,
          rowing_required: true,
        },
      });
    }

    // Power requirement for utility surfaces
    for (const utilitySurface of utilitySurfaces.slice(0, 2)) {
      surfaceRequirements.push({
        tenantId: TEST_TENANT_ID,
        portalId: TEST_PORTAL_ID,
        runId: run.id,
        segmentId: segments[1].id, // Work segment
        surfaceId: utilitySurface.id,
        requiredSurfaceType: 'utility',
        demand: {
          watts_continuous: 500,
          hours: 4,
        },
      });
    }

    if (surfaceRequirements.length > 0) {
      await db.insert(ccN3SurfaceRequirements).values(surfaceRequirements);
      console.log(`[N3 Seed] Created ${surfaceRequirements.length} surface requirements`);
    } else {
      console.log('[N3 Seed] No surface requirements created (run surface seed first)');
    }

    const tidePredictions = generateTidePredictions(BAMFIELD_LOCATION, runStartTime, 7);
    
    for (let i = 0; i < tidePredictions.length; i += 100) {
      const batch = tidePredictions.slice(i, i + 100);
      await db.insert(ccTidePredictions).values(batch).onConflictDoNothing();
    }

    console.log(`[N3 Seed] Created ${tidePredictions.length} tide predictions`);

    const weatherNormals = generateWeatherNormals(BAMFIELD_LOCATION);
    
    for (let i = 0; i < weatherNormals.length; i += 100) {
      const batch = weatherNormals.slice(i, i + 100);
      await db.insert(ccWeatherNormals).values(batch).onConflictDoNothing();
    }

    console.log(`[N3 Seed] Created ${weatherNormals.length} weather normals`);

    console.log('[N3 Seed] Triggering evaluation...');
    const result = await evaluateServiceRun(run.id, run.tenantId, TEST_PORTAL_ID);
    const bundleId = await saveEvaluationResult(result);

    console.log(`[N3 Seed] Evaluation complete: risk=${result.riskLevel}, score=${result.riskScore.toFixed(3)}, bundle=${bundleId}`);
    console.log(`[N3 Seed] Effective capacity segments: ${result.effectiveCapacityBySegment?.length || 0}`);

    res.json({
      success: true,
      message: 'N3 seed complete',
      data: {
        run: {
          id: run.id,
          name: run.name,
          startsAt: run.startsAt,
        },
        segmentCount: segments.length,
        tidePredictionCount: tidePredictions.length,
        weatherNormalCount: weatherNormals.length,
        evaluation: {
          riskScore: result.riskScore,
          riskLevel: result.riskLevel,
          findingsCount: result.findings.length,
          effectiveCapacitySegments: result.effectiveCapacityBySegment?.length || 0,
          bundleId,
        },
        surfaceRequirementsCount: surfaceRequirements.length,
      },
    });

  } catch (err) {
    console.error('[N3 Seed] Error:', err);
    res.status(500).json({ error: 'N3 seed failed', details: String(err) });
  }
});

router.get('/n3/status', async (_req, res) => {
  try {
    const runsCount = await db.select().from(ccN3Runs);
    const segmentsCount = await db.select().from(ccN3Segments);
    const tidesCount = await db.select().from(ccTidePredictions);
    const weatherCount = await db.select().from(ccWeatherNormals);

    res.json({
      runs: runsCount.length,
      segments: segmentsCount.length,
      tidePredictions: tidesCount.length,
      weatherNormals: weatherCount.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
