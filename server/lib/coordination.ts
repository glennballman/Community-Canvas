/**
 * Coordination Signals - Pre-Incentive System
 * 
 * Provides "similar work request" detection for zone coordination signals.
 * Advisory only - no auto-actions, no persistence, no billing impact.
 * 
 * Similarity is determined by (in priority order):
 * 1. Same portal_id
 * 2. Same zone_id (or both null for unzoned)
 * 3. Same subsystem_id OR work_area_id OR category (whichever exists)
 */

export interface SimilarityKey {
  subsystem_id?: string | null;
  work_area_id?: string | null;
  category?: string | null;
}

export interface WorkRequestRow {
  id: string;
  portal_id: string | null;
  zone_id: string | null;
  subsystem_id?: string | null;
  work_area_id?: string | null;
  category?: string | null;
  kind?: string | null;
}

/**
 * Build a similarity key from a work request row.
 * Uses priority: subsystem_id > work_area_id > category/kind
 */
export function buildSimilarityKey(row: WorkRequestRow): SimilarityKey {
  const key: SimilarityKey = {};
  
  if (row.subsystem_id) {
    key.subsystem_id = row.subsystem_id;
  } else if (row.work_area_id) {
    key.work_area_id = row.work_area_id;
  } else if (row.category) {
    key.category = row.category;
  } else if (row.kind) {
    key.category = row.kind;
  }
  
  return key;
}

/**
 * Get the primary similarity field value for grouping.
 * Returns the value and its type for SQL filtering.
 */
export function getSimilarityValue(key: SimilarityKey): { field: string; value: string | null } | null {
  if (key.subsystem_id) {
    return { field: 'subsystem_id', value: key.subsystem_id };
  }
  if (key.work_area_id) {
    return { field: 'work_area_id', value: key.work_area_id };
  }
  if (key.category) {
    return { field: 'category', value: key.category };
  }
  return null;
}

/**
 * Build SQL WHERE conditions for similarity matching.
 * Returns conditions array and parameters to append.
 */
export function buildSimilarityConditions(
  key: SimilarityKey,
  params: any[],
  startIndex: number
): { conditions: string[]; newParams: any[]; nextIndex: number } {
  const conditions: string[] = [];
  const newParams: any[] = [];
  let idx = startIndex;
  
  if (key.subsystem_id) {
    conditions.push(`subsystem_id = $${idx}`);
    newParams.push(key.subsystem_id);
    idx++;
  } else if (key.work_area_id) {
    conditions.push(`work_area_id = $${idx}`);
    newParams.push(key.work_area_id);
    idx++;
  } else if (key.category) {
    conditions.push(`category = $${idx}`);
    newParams.push(key.category);
    idx++;
  }
  
  return { conditions, newParams, nextIndex: idx };
}

/**
 * Get the label for a similarity bucket (for UI display).
 */
export function getSimilarityLabel(key: SimilarityKey, metadata?: { subsystemName?: string }): string {
  if (key.subsystem_id) {
    return metadata?.subsystemName || `Subsystem: ${key.subsystem_id.substring(0, 8)}`;
  }
  if (key.work_area_id) {
    return `Work Area: ${key.work_area_id.substring(0, 8)}`;
  }
  if (key.category) {
    return key.category;
  }
  return 'Uncategorized';
}

/**
 * Active work request statuses for coordination counting.
 */
export const ACTIVE_STATUSES = ['new', 'contacted', 'quoted', 'scheduled'] as const;

/**
 * New statuses (subset of active) for "new count".
 */
export const NEW_STATUSES = ['new'] as const;

/**
 * Window days clamped to 1-60 range.
 */
export function clampWindowDays(days: number | string | undefined, defaultDays = 14): number {
  if (days === undefined || days === null) return defaultDays;
  
  const parsed = typeof days === 'string' ? parseInt(days, 10) : days;
  if (isNaN(parsed)) return defaultDays;
  
  return Math.max(1, Math.min(60, parsed));
}
