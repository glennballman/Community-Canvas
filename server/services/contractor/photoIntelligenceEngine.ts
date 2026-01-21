/**
 * A2.7: Photo Intelligence Engine
 * 
 * Builds timelines and computes bundle intelligence from before/during/after photos.
 * Uses deterministic heuristics for ordering and completeness scoring.
 */

import { db } from '../../db';
import { ccContractorPhotoBundles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { normalizeBundleArraysToMediaIds, ResolvedMediaItem } from './bundleMediaResolver';
import { buildProofJson, ProofJson } from './proofBundleBuilder';

export interface TimelineItem {
  id: string;
  stage: 'before' | 'during' | 'after';
  capturedAt: string | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  qualityScore: number;
  sortOrder: number;
}

export interface TimelineJson {
  items: TimelineItem[];
  ordering: 'chronological' | 'unknown';
  completeness: 'complete' | 'incomplete';
  reasoning: string;
  totalQualityScore: number;
}

interface BuildTimelineParams {
  tenantId: string;
  contractorProfileId: string;
  bundleId: string;
  force?: boolean;
}

interface BuildTimelineResult {
  ok: boolean;
  bundle?: any;
  error?: string;
}

/**
 * Computes a quality score for a media item (0-100).
 * Weighting: timestamp (30), geo (30), resolution (20), fileSize (20)
 */
function computeQualityScore(item: ResolvedMediaItem): number {
  let score = 0;
  
  // +30 if capturedAt present (timestamp is critical for timeline ordering)
  if (item.capturedAt) score += 30;
  
  // +30 if geo present (location verification is critical for proof)
  if (item.lat !== null && item.lng !== null) score += 30;
  
  // +20 if resolution available and reasonable (>= 640px width)
  if (item.width && item.width >= 640) score += 20;
  
  // +20 if file size available (indicates real image)
  if (item.fileSize && item.fileSize > 0) score += 20;
  
  return score;
}

/**
 * Converts resolved media items to timeline items with stage assignment.
 */
function toTimelineItems(
  items: ResolvedMediaItem[], 
  stage: 'before' | 'during' | 'after',
  startOrder: number
): TimelineItem[] {
  return items
    .filter(item => item.url) // Only include items with valid URLs
    .map((item, idx) => ({
      id: item.mediaId || item.ingestionId || `unknown-${idx}`,
      stage,
      capturedAt: item.capturedAt?.toISOString() ?? null,
      lat: item.lat,
      lng: item.lng,
      url: item.url,
      qualityScore: computeQualityScore(item),
      sortOrder: startOrder + idx
    }));
}

/**
 * Determines completeness based on bundle type.
 */
function determineCompleteness(
  bundleType: string,
  beforeCount: number,
  afterCount: number,
  duringCount: number
): { complete: boolean; reasoning: string } {
  if (bundleType === 'before_after') {
    // Complete when: >=1 before AND >=1 after
    const complete = beforeCount >= 1 && afterCount >= 1;
    const reasoning = complete 
      ? `Before/after bundle complete: ${beforeCount} before, ${afterCount} after`
      : `Missing ${beforeCount < 1 ? 'before' : ''}${beforeCount < 1 && afterCount < 1 ? ' and ' : ''}${afterCount < 1 ? 'after' : ''} photos`;
    return { complete, reasoning };
  }
  
  if (bundleType === 'progress_series') {
    // Complete when: >=3 during OR (>=1 before AND >=1 after AND >=1 during)
    const hasEnoughDuring = duringCount >= 3;
    const hasAllStages = beforeCount >= 1 && afterCount >= 1 && duringCount >= 1;
    const complete = hasEnoughDuring || hasAllStages;
    const reasoning = complete
      ? `Progress series complete: ${beforeCount} before, ${duringCount} during, ${afterCount} after`
      : `Need more progress photos (${duringCount}/3 during, or all stages)`;
    return { complete, reasoning };
  }
  
  // Unknown bundle type
  return { complete: false, reasoning: `Unknown bundle type: ${bundleType}` };
}

/**
 * Computes centroid from media items with geo data.
 */
function computeCentroid(items: ResolvedMediaItem[]): { lat: number | null; lng: number | null } {
  const geoItems = items.filter(i => i.lat !== null && i.lng !== null);
  if (geoItems.length === 0) return { lat: null, lng: null };
  
  const sumLat = geoItems.reduce((sum, i) => sum + (i.lat ?? 0), 0);
  const sumLng = geoItems.reduce((sum, i) => sum + (i.lng ?? 0), 0);
  
  return {
    lat: sumLat / geoItems.length,
    lng: sumLng / geoItems.length
  };
}

/**
 * Computes time range from media items with capturedAt.
 */
function computeTimeRange(items: ResolvedMediaItem[]): { from: Date | null; to: Date | null } {
  const dated = items.filter(i => i.capturedAt !== null);
  if (dated.length === 0) return { from: null, to: null };
  
  const sorted = dated.sort((a, b) => 
    (a.capturedAt?.getTime() ?? 0) - (b.capturedAt?.getTime() ?? 0)
  );
  
  return {
    from: sorted[0].capturedAt,
    to: sorted[sorted.length - 1].capturedAt
  };
}

/**
 * Main function: Build or update timeline for a bundle.
 */
export async function buildOrUpdateTimelineForBundle(
  params: BuildTimelineParams
): Promise<BuildTimelineResult> {
  const { tenantId, contractorProfileId, bundleId, force } = params;
  
  // Load the bundle
  const bundles = await db.select()
    .from(ccContractorPhotoBundles)
    .where(eq(ccContractorPhotoBundles.id, bundleId))
    .limit(1);
  
  if (bundles.length === 0) {
    return { ok: false, error: 'Bundle not found' };
  }
  
  const bundle = bundles[0];
  
  // Security check: verify tenant ownership
  if (bundle.tenantId !== tenantId) {
    return { ok: false, error: 'Unauthorized: bundle belongs to different tenant' };
  }
  
  // Skip recompute if already confirmed (unless forced)
  if (bundle.status === 'confirmed' && !force) {
    return { ok: true, bundle, error: 'Bundle already confirmed, use force=true to recompute' };
  }
  
  // Resolve all media items
  const { beforeItems, afterItems, duringItems } = await normalizeBundleArraysToMediaIds(bundle);
  
  // Build timeline items
  const allItems: TimelineItem[] = [
    ...toTimelineItems(beforeItems, 'before', 0),
    ...toTimelineItems(duringItems, 'during', beforeItems.length),
    ...toTimelineItems(afterItems, 'after', beforeItems.length + duringItems.length)
  ];
  
  // Sort by capturedAt if available
  const hasChronology = allItems.some(i => i.capturedAt !== null);
  if (hasChronology) {
    allItems.sort((a, b) => {
      if (!a.capturedAt) return 1;
      if (!b.capturedAt) return -1;
      return new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
    });
    // Update sort orders after chronological sort
    allItems.forEach((item, idx) => item.sortOrder = idx);
  }
  
  // Determine completeness
  const { complete, reasoning } = determineCompleteness(
    bundle.bundleType,
    beforeItems.length,
    afterItems.length,
    duringItems.length
  );
  
  // Compute total quality score
  const totalQualityScore = allItems.reduce((sum, i) => sum + i.qualityScore, 0);
  
  // Build timeline JSON
  const timelineJson: TimelineJson = {
    items: allItems,
    ordering: hasChronology ? 'chronological' : 'unknown',
    completeness: complete ? 'complete' : 'incomplete',
    reasoning,
    totalQualityScore
  };
  
  // Build proof JSON using the proof builder
  const proofJson = buildProofJson(bundle, timelineJson);
  
  // Compute centroid and time range
  const allResolvedItems = [...beforeItems, ...duringItems, ...afterItems];
  const centroid = computeCentroid(allResolvedItems);
  const timeRange = computeTimeRange(allResolvedItems);
  
  // Determine new status
  let newStatus = complete ? 'complete' : 'incomplete';
  // Don't downgrade confirmed bundles unless forced
  if (bundle.status === 'confirmed' && !force) {
    newStatus = 'confirmed';
  }
  
  // Determine missing stage for UI hint
  let missingStage: string | null = null;
  if (!complete) {
    if (beforeItems.length === 0) missingStage = 'before';
    else if (afterItems.length === 0) missingStage = 'after';
    else if (bundle.bundleType === 'progress_series' && duringItems.length < 3) missingStage = 'during';
  }
  
  // Update the bundle
  const [updatedBundle] = await db.update(ccContractorPhotoBundles)
    .set({
      timelineJson,
      proofJson,
      coversFrom: timeRange.from,
      coversTo: timeRange.to,
      centroidLat: centroid.lat?.toString() ?? null,
      centroidLng: centroid.lng?.toString() ?? null,
      status: newStatus,
      missingStage,
      updatedAt: new Date(),
      completedAt: complete ? new Date() : null
    })
    .where(eq(ccContractorPhotoBundles.id, bundleId))
    .returning();
  
  return { ok: true, bundle: updatedBundle };
}
