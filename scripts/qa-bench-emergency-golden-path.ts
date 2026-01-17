/**
 * QA Golden Path: Bench Depth + Emergency Replacement
 * 
 * This script seeds deterministic test data and runs assertions for:
 * - Bench depth layers (readiness states)
 * - Housing waitlist tiering + staging
 * - Emergency replacement ranking + dedupe
 * 
 * Safe to run repeatedly (idempotent via qa_bench_emergency_ prefix cleanup)
 * 
 * Usage: npx tsx scripts/qa-bench-emergency-golden-path.ts
 */

import { Pool } from 'pg';

const QA_PREFIX = 'qa_bench_emergency_';
const PORTAL_SLUG = 'bamfield-qa';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function pass(name: string, message: string = '') {
  results.push({ name, passed: true, message });
  console.log(`✅ PASS: ${name}${message ? ` - ${message}` : ''}`);
}

function fail(name: string, message: string) {
  results.push({ name, passed: false, message });
  console.log(`❌ FAIL: ${name} - ${message}`);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  console.log('\n========================================');
  console.log('QA Golden Path: Bench + Emergency');
  console.log('========================================\n');

  try {
    // Set service mode for all queries
    const client = await pool.connect();
    await client.query(`SELECT set_config('app.tenant_id', '__SERVICE__', false)`);
    await client.query(`SELECT set_config('app.portal_id', '__SERVICE__', false)`);
    await client.query(`SELECT set_config('app.individual_id', '__SERVICE__', false)`);

    // ============================================
    // CLEANUP: Remove previous QA data
    // ============================================
    console.log('🧹 Cleaning up previous QA data...\n');
    
    // Delete emergency requests first (FK to bench)
    await client.query(`
      DELETE FROM cc_emergency_replacement_requests 
      WHERE notes LIKE '${QA_PREFIX}%'
    `);
    
    // Delete housing waitlist entries
    await client.query(`
      DELETE FROM cc_portal_housing_waitlist_entries 
      WHERE notes LIKE '${QA_PREFIX}%'
    `);
    
    // Delete bench entries
    await client.query(`
      DELETE FROM cc_portal_candidate_bench 
      WHERE location_note LIKE '${QA_PREFIX}%'
    `);
    
    // Delete test individuals
    await client.query(`
      DELETE FROM cc_individuals 
      WHERE email LIKE '${QA_PREFIX}%'
    `);

    // ============================================
    // STEP 1: Ensure portal exists (Bamfield)
    // ============================================
    console.log('📍 Step 1: Ensuring portal exists...\n');
    
    let portalResult = await client.query(`
      SELECT id, owning_tenant_id FROM cc_portals WHERE slug = $1
    `, [PORTAL_SLUG]);
    
    let portalId: string;
    let tenantId: string;
    
    if (portalResult.rows.length === 0) {
      // Get a tenant to attach portal to
      const tenantResult = await client.query(`
        SELECT id FROM cc_tenants LIMIT 1
      `);
      tenantId = tenantResult.rows[0]?.id;
      
      if (!tenantId) {
        fail('Portal setup', 'No tenant found to create portal');
        return;
      }
      
      const newPortal = await client.query(`
        INSERT INTO cc_portals (id, owning_tenant_id, slug, name, status)
        VALUES (gen_random_uuid(), $1, $2, 'Bamfield QA Portal', 'active')
        RETURNING id, owning_tenant_id
      `, [tenantId, PORTAL_SLUG]);
      
      portalId = newPortal.rows[0].id;
      tenantId = newPortal.rows[0].owning_tenant_id;
      console.log(`   Created new portal: ${portalId}\n`);
    } else {
      portalId = portalResult.rows[0].id;
      tenantId = portalResult.rows[0].owning_tenant_id;
      console.log(`   Using existing portal: ${portalId}\n`);
    }

    // ============================================
    // STEP 2: Create 6 individuals
    // ============================================
    console.log('👤 Step 2: Creating 6 test individuals...\n');
    
    const individuals: { id: string; name: string; readiness: string; activity: Date; housing: boolean }[] = [];
    const now = new Date();
    
    const testCases = [
      { name: 'Alice OnSite Hostel', readiness: 'on_site', daysAgo: 1, housing: true, staging: 'hostel' },
      { name: 'Bob OnSite Campground', readiness: 'on_site', daysAgo: 3, housing: true, staging: 'campground' },
      { name: 'Carol Ready One', readiness: 'ready', daysAgo: 2, housing: false, staging: null },
      { name: 'Dan Ready Two', readiness: 'ready', daysAgo: 5, housing: true, staging: null },
      { name: 'Eve Ready Three', readiness: 'ready', daysAgo: 7, housing: false, staging: null },
      { name: 'Frank Cleared', readiness: 'cleared', daysAgo: 10, housing: false, staging: null },
    ];
    
    for (const tc of testCases) {
      const email = `${QA_PREFIX}${tc.name.toLowerCase().replace(/\s+/g, '_')}@test.local`;
      const activityDate = new Date(now.getTime() - tc.daysAgo * 24 * 60 * 60 * 1000);
      
      const indResult = await client.query(`
        INSERT INTO cc_individuals (id, full_name, email, status)
        VALUES (gen_random_uuid(), $1, $2, 'active')
        RETURNING id
      `, [tc.name, email]);
      
      individuals.push({
        id: indResult.rows[0].id,
        name: tc.name,
        readiness: tc.readiness,
        activity: activityDate,
        housing: tc.housing
      });
    }
    
    console.log(`   Created ${individuals.length} individuals\n`);

    // ============================================
    // STEP 3: Upsert into cc_portal_candidate_bench
    // ============================================
    console.log('📋 Step 3: Upserting bench entries...\n');
    
    for (let i = 0; i < individuals.length; i++) {
      const ind = individuals[i];
      const tc = testCases[i];
      
      await client.query(`
        INSERT INTO cc_portal_candidate_bench (
          id, portal_id, individual_id, readiness_state, 
          housing_needed, location_note, last_activity_at
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6
        )
        ON CONFLICT (portal_id, individual_id) DO UPDATE SET
          readiness_state = EXCLUDED.readiness_state,
          housing_needed = EXCLUDED.housing_needed,
          location_note = EXCLUDED.location_note,
          last_activity_at = EXCLUDED.last_activity_at,
          updated_at = now()
      `, [
        portalId, 
        ind.id, 
        ind.readiness, 
        ind.housing,
        `${QA_PREFIX}${tc.staging || 'none'}`,
        ind.activity
      ]);
    }
    
    // Verify bench count
    const benchCount = await client.query(`
      SELECT COUNT(*) as cnt FROM cc_portal_candidate_bench 
      WHERE portal_id = $1 AND location_note LIKE '${QA_PREFIX}%'
    `, [portalId]);
    
    const benchCnt = parseInt(benchCount.rows[0].cnt);
    if (benchCnt === 6) {
      pass('Bench upsert', `created exactly 6 records for portal`);
    } else {
      fail('Bench upsert', `expected 6 records, got ${benchCnt}`);
    }

    // ============================================
    // STEP 4: Create housing waitlist entries for on_site candidates
    // ============================================
    console.log('\n🏠 Step 4: Creating housing waitlist entries with tiering...\n');
    
    const onSiteIndividuals = individuals.filter((_, i) => testCases[i].readiness === 'on_site');
    
    // Get bench IDs for on_site candidates
    const benchIds = await client.query(`
      SELECT b.id, b.individual_id FROM cc_portal_candidate_bench b
      WHERE b.portal_id = $1 
        AND b.individual_id = ANY($2::uuid[])
    `, [portalId, onSiteIndividuals.map(i => i.id)]);
    
    // Alice gets higher priority (staging = hostel)
    // Bob gets lower priority (staging = campground)
    const tieringConfig = [
      { idx: 0, tier: 'temporary', priority: 80, staging: 'hostel' },
      { idx: 1, tier: 'emergency', priority: 50, staging: 'campground' }
    ];
    
    for (const tc of tieringConfig) {
      const ind = onSiteIndividuals[tc.idx];
      if (!ind) continue;
      
      await client.query(`
        INSERT INTO cc_portal_housing_waitlist_entries (
          id, portal_id, applicant_individual_id, applicant_name, applicant_email,
          status, housing_tier_assigned, staging_location_note, priority_score, notes
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          'new', $5, $6, $7, $8
        )
      `, [
        portalId,
        ind.id,
        ind.name,
        `${QA_PREFIX}${ind.name.toLowerCase().replace(/\s+/g, '_')}@test.local`,
        tc.tier,
        tc.staging,
        tc.priority,
        `${QA_PREFIX}tiering_test`
      ]);
    }
    
    // Verify waitlist entries
    const waitlistCount = await client.query(`
      SELECT COUNT(*) as cnt FROM cc_portal_housing_waitlist_entries 
      WHERE portal_id = $1 AND notes LIKE '${QA_PREFIX}%'
    `, [portalId]);
    
    const waitlistCnt = parseInt(waitlistCount.rows[0].cnt);
    if (waitlistCnt === 2) {
      pass('Waitlist entries', `created exactly 2 entries with tier + staging`);
    } else {
      fail('Waitlist entries', `expected 2 entries, got ${waitlistCnt}`);
    }

    // ============================================
    // STEP 5: Create emergency replacement request
    // ============================================
    console.log('\n🚨 Step 5: Creating emergency replacement request...\n');
    
    const emergencyResult = await client.query(`
      INSERT INTO cc_emergency_replacement_requests (
        id, portal_id, tenant_id, role_title_snapshot, urgency, status, notes
      )
      VALUES (
        gen_random_uuid(), $1, $2, 'Housekeeper (Emergency Replacement)', 'today', 'open', $3
      )
      RETURNING id
    `, [portalId, tenantId, `${QA_PREFIX}emergency_test`]);
    
    const emergencyId = emergencyResult.rows[0].id;
    console.log(`   Created emergency request: ${emergencyId}\n`);

    // ============================================
    // STEP 6: Test candidate ordering
    // ============================================
    console.log('📊 Step 6: Testing candidate ordering...\n');
    
    // Query candidates sorted by: readiness priority, then activity recency
    // Readiness priority: on_site > ready > cleared > prospect
    const candidatesQuery = await client.query(`
      SELECT 
        b.id,
        i.full_name,
        b.readiness_state,
        b.last_activity_at,
        COALESCE(hw.priority_score, 0) as priority_score
      FROM cc_portal_candidate_bench b
      JOIN cc_individuals i ON i.id = b.individual_id
      LEFT JOIN cc_portal_housing_waitlist_entries hw 
        ON hw.applicant_individual_id = b.individual_id 
        AND hw.portal_id = b.portal_id
      WHERE b.portal_id = $1 AND b.location_note LIKE '${QA_PREFIX}%'
      ORDER BY 
        CASE b.readiness_state
          WHEN 'on_site' THEN 1
          WHEN 'ready' THEN 2
          WHEN 'cleared' THEN 3
          WHEN 'prospect' THEN 4
          ELSE 5
        END,
        COALESCE(hw.priority_score, 0) DESC,
        b.last_activity_at DESC
    `, [portalId]);
    
    console.log('   Ordered candidates:');
    candidatesQuery.rows.forEach((r, i) => {
      console.log(`     ${i + 1}. ${r.full_name} (${r.readiness_state}, priority=${r.priority_score})`);
    });
    console.log('');
    
    // Verify ordering: on_site candidates should come before ready, ready before cleared
    const orderedNames = candidatesQuery.rows.map(r => r.full_name);
    const orderedStates = candidatesQuery.rows.map(r => r.readiness_state);
    
    const aliceIdx = orderedNames.indexOf('Alice OnSite Hostel');
    const bobIdx = orderedNames.indexOf('Bob OnSite Campground');
    const carolIdx = orderedNames.indexOf('Carol Ready One');
    const danIdx = orderedNames.indexOf('Dan Ready Two');
    const eveIdx = orderedNames.indexOf('Eve Ready Three');
    const frankIdx = orderedNames.indexOf('Frank Cleared');
    
    // Verify readiness state ordering is correct
    const onSiteLast = Math.max(aliceIdx, bobIdx);
    const readyFirst = Math.min(carolIdx, danIdx, eveIdx);
    const readyLast = Math.max(carolIdx, danIdx, eveIdx);
    
    // Alice (priority 80) should be before Bob (priority 50) within on_site
    // All on_site (Alice, Bob) should be before any ready (Carol, Dan, Eve)
    // All ready should be before cleared (Frank)
    // Frank (cleared) should be last
    const orderCorrect = 
      aliceIdx === 0 && 
      bobIdx === 1 && 
      onSiteLast < readyFirst && 
      readyLast < frankIdx &&
      frankIdx === 5;
    
    if (orderCorrect) {
      pass('Candidate ordering', `on_site (by priority) > ready > cleared (Frank last at idx 5)`);
    } else {
      fail('Candidate ordering', `unexpected order: Alice=${aliceIdx}, Bob=${bobIdx}, Carol=${carolIdx}, Dan=${danIdx}, Eve=${eveIdx}, Frank=${frankIdx}`);
    }

    // ============================================
    // STEP 7: Test routing idempotency
    // ============================================
    console.log('\n🔄 Step 7: Testing routing idempotency...\n');
    
    // Get Alice's bench ID
    const aliceBench = await client.query(`
      SELECT b.id FROM cc_portal_candidate_bench b
      JOIN cc_individuals i ON i.id = b.individual_id
      WHERE b.portal_id = $1 AND i.full_name = 'Alice OnSite Hostel'
    `, [portalId]);
    
    const aliceBenchId = aliceBench.rows[0]?.id;
    
    if (!aliceBenchId) {
      fail('Routing setup', 'Could not find Alice bench entry');
    } else {
      // First route: fill the request with Alice
      await client.query(`
        UPDATE cc_emergency_replacement_requests 
        SET filled_by_bench_id = $1, status = 'filled', updated_at = now()
        WHERE id = $2 AND filled_by_bench_id IS NULL
      `, [aliceBenchId, emergencyId]);
      
      // Check it was filled
      const firstRoute = await client.query(`
        SELECT filled_by_bench_id FROM cc_emergency_replacement_requests WHERE id = $1
      `, [emergencyId]);
      
      if (firstRoute.rows[0]?.filled_by_bench_id === aliceBenchId) {
        pass('First routing', 'emergency request filled successfully');
      } else {
        fail('First routing', 'emergency request was not filled');
      }
      
      // Second route attempt: should be no-op (already filled)
      const secondRouteResult = await client.query(`
        UPDATE cc_emergency_replacement_requests 
        SET filled_by_bench_id = $1, status = 'filled', updated_at = now()
        WHERE id = $2 AND filled_by_bench_id IS NULL
        RETURNING id
      `, [aliceBenchId, emergencyId]);
      
      if (secondRouteResult.rowCount === 0) {
        pass('Second routing', 'correctly rejected (idempotent - no duplicate)');
      } else {
        fail('Second routing', 'should have been rejected but was processed');
      }
    }

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================\n');
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    results.forEach(r => {
      const icon = r.passed ? '✅' : '❌';
      console.log(`${icon} ${r.name}${r.message ? `: ${r.message}` : ''}`);
    });
    
    console.log(`\n${passed} passed, ${failed} failed\n`);
    
    client.release();
    await pool.end();
    
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('Fatal error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
