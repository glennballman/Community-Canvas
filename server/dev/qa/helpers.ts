/**
 * V3.5 QA Runner: Helper Functions
 * "Latest ID" resolvers for dynamic page tests
 */

import { serviceQuery } from '../../db/tenantDb';

export interface LatestIds {
  workRequestId: string | null;
  serviceRunSlug: string | null;
  serviceRunId: string | null;
  monitorRunId: string | null;
}

/**
 * Get the latest work request ID from the database
 */
export async function getLatestWorkRequestId(): Promise<string | null> {
  try {
    const result = await serviceQuery(`
      SELECT id FROM cc_work_requests 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    return result.rows[0]?.id || null;
  } catch (e) {
    console.warn('[QA] Failed to get latest work request:', e);
    return null;
  }
}

/**
 * Get the latest service run slug and ID
 */
export async function getLatestServiceRunSlugAndId(): Promise<{ slug: string; id: string } | null> {
  try {
    const result = await serviceQuery(`
      SELECT id, slug FROM cc_n3_runs 
      WHERE slug IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    if (result.rows[0]) {
      return { slug: result.rows[0].slug, id: result.rows[0].id };
    }
    return null;
  } catch (e) {
    console.warn('[QA] Failed to get latest service run:', e);
    return null;
  }
}

/**
 * Get the latest N3 monitor run ID
 */
export async function getLatestMonitorRunId(): Promise<string | null> {
  try {
    const result = await serviceQuery(`
      SELECT id FROM cc_n3_runs 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    return result.rows[0]?.id || null;
  } catch (e) {
    console.warn('[QA] Failed to get latest monitor run:', e);
    return null;
  }
}

/**
 * Resolve all latest IDs at once
 */
export async function resolveAllLatestIds(): Promise<LatestIds> {
  const [workRequestId, serviceRun, monitorRunId] = await Promise.all([
    getLatestWorkRequestId(),
    getLatestServiceRunSlugAndId(),
    getLatestMonitorRunId()
  ]);
  
  return {
    workRequestId,
    serviceRunSlug: serviceRun?.slug || null,
    serviceRunId: serviceRun?.id || null,
    monitorRunId
  };
}

/**
 * Replace :id, :slug, :runId, :workRequestId placeholders in path
 */
export function resolvePath(path: string, ids: LatestIds): string | null {
  let resolved = path;
  
  if (path.includes(':id') || path.includes(':workRequestId')) {
    if (!ids.workRequestId) return null;
    resolved = resolved.replace(':id', ids.workRequestId).replace(':workRequestId', ids.workRequestId);
  }
  
  if (path.includes(':slug')) {
    if (!ids.serviceRunSlug) return null;
    resolved = resolved.replace(':slug', ids.serviceRunSlug);
  }
  
  if (path.includes(':runId')) {
    if (!ids.monitorRunId) return null;
    resolved = resolved.replace(':runId', ids.monitorRunId);
  }
  
  return resolved;
}

/**
 * Check if personas exist in the database
 */
export async function checkPersonasExist(): Promise<{ exists: boolean; found: string[] }> {
  try {
    const result = await serviceQuery(`
      SELECT email FROM cc_users 
      WHERE email IN ('ellen@example.com', 'tester@example.com', 'wade@example.com')
    `);
    const found = result.rows.map((r: any) => r.email);
    return { exists: found.length >= 3, found };
  } catch (e) {
    console.warn('[QA] Failed to check personas:', e);
    return { exists: false, found: [] };
  }
}

/**
 * Check if demo seed data exists
 */
export async function checkDemoSeedExists(): Promise<boolean> {
  try {
    const result = await serviceQuery(`
      SELECT EXISTS(
        SELECT 1 FROM cc_users WHERE email = 'ellen@example.com'
      ) as has_ellen
    `);
    return result.rows[0]?.has_ellen || false;
  } catch (e) {
    return false;
  }
}
