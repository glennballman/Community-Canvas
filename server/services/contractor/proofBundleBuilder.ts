/**
 * A2.7: Proof Bundle Builder
 * 
 * Builds structured proof JSON from bundle timeline.
 * Generates claims, missing items, and risk flags.
 * No legal text - just structured evidence data.
 */

import type { TimelineJson } from './photoIntelligenceEngine';

export interface MissingItem {
  prompt: string;
  actionType: 'request_more_photos';
  stage: 'before' | 'during' | 'after';
}

export interface ProofJson {
  claims: string[];
  missingItems: MissingItem[];
  riskFlags: string[];
  exportReady: boolean;
}

/**
 * Builds proof JSON from bundle and its computed timeline.
 */
export function buildProofJson(
  bundle: {
    bundleType: string;
    beforeMediaIds: unknown;
    afterMediaIds: unknown;
    duringMediaIds?: unknown;
  },
  timelineJson: TimelineJson
): ProofJson {
  const claims: string[] = [];
  const missingItems: MissingItem[] = [];
  const riskFlags: string[] = [];
  
  const beforeIds = Array.isArray(bundle.beforeMediaIds) ? bundle.beforeMediaIds : [];
  const afterIds = Array.isArray(bundle.afterMediaIds) ? bundle.afterMediaIds : [];
  const duringIds = Array.isArray(bundle.duringMediaIds) ? bundle.duringMediaIds : [];
  
  const beforeCount = beforeIds.length;
  const afterCount = afterIds.length;
  const duringCount = duringIds.length;
  
  // Generate claims based on what's present
  if (beforeCount > 0 && afterCount > 0) {
    claims.push('Before/After evidence present');
  }
  
  if (beforeCount > 0) {
    claims.push(`${beforeCount} before photo${beforeCount > 1 ? 's' : ''} captured`);
  }
  
  if (afterCount > 0) {
    claims.push(`${afterCount} after photo${afterCount > 1 ? 's' : ''} captured`);
  }
  
  if (duringCount > 0) {
    claims.push(`${duringCount} progress photo${duringCount > 1 ? 's' : ''} captured`);
  }
  
  if (timelineJson.ordering === 'chronological') {
    claims.push('Chronological ordering verified');
  }
  
  // Check for geo presence
  const geoItems = timelineJson.items.filter(i => i.lat !== null && i.lng !== null);
  if (geoItems.length > 0) {
    claims.push(`${geoItems.length} photos with GPS location`);
  }
  
  // Generate missing items based on bundle type
  if (bundle.bundleType === 'before_after') {
    if (beforeCount === 0) {
      missingItems.push({
        prompt: 'Add a BEFORE photo showing initial conditions',
        actionType: 'request_more_photos',
        stage: 'before'
      });
    }
    
    if (afterCount === 0) {
      missingItems.push({
        prompt: 'Add an AFTER photo showing completed work',
        actionType: 'request_more_photos',
        stage: 'after'
      });
    }
    
    // Suggest wide shot if only one before
    if (beforeCount === 1) {
      missingItems.push({
        prompt: 'Add a wide BEFORE photo from 10 steps back for context',
        actionType: 'request_more_photos',
        stage: 'before'
      });
    }
    
    // Suggest wide shot if only one after
    if (afterCount === 1) {
      missingItems.push({
        prompt: 'Add a wide AFTER photo from 10 steps back for context',
        actionType: 'request_more_photos',
        stage: 'after'
      });
    }
  }
  
  if (bundle.bundleType === 'progress_series') {
    if (duringCount < 3) {
      missingItems.push({
        prompt: `Add ${3 - duringCount} more progress photo${3 - duringCount > 1 ? 's' : ''} to complete the series`,
        actionType: 'request_more_photos',
        stage: 'during'
      });
    }
    
    if (beforeCount === 0) {
      missingItems.push({
        prompt: 'Add a BEFORE photo to establish baseline',
        actionType: 'request_more_photos',
        stage: 'before'
      });
    }
    
    if (afterCount === 0) {
      missingItems.push({
        prompt: 'Add an AFTER photo to show completion',
        actionType: 'request_more_photos',
        stage: 'after'
      });
    }
  }
  
  // Generate risk flags
  const itemsWithoutTimestamp = timelineJson.items.filter(i => !i.capturedAt);
  if (itemsWithoutTimestamp.length > 0) {
    riskFlags.push(`no_timestamp_on_${itemsWithoutTimestamp.length}_items`);
  }
  
  const itemsWithoutGeo = timelineJson.items.filter(i => i.lat === null || i.lng === null);
  if (itemsWithoutGeo.length > 0 && itemsWithoutGeo.length < timelineJson.items.length) {
    riskFlags.push(`missing_gps_on_${itemsWithoutGeo.length}_items`);
  }
  
  if (timelineJson.ordering === 'unknown') {
    riskFlags.push('chronology_unverifiable');
  }
  
  // Low quality warning
  const avgQuality = timelineJson.items.length > 0 
    ? timelineJson.totalQualityScore / timelineJson.items.length 
    : 0;
  if (avgQuality < 50) {
    riskFlags.push('low_quality_average');
  }
  
  // Determine if export ready (complete, no critical missing items, no critical flags)
  const exportReady = 
    timelineJson.completeness === 'complete' && 
    missingItems.filter(m => m.stage === 'before' || m.stage === 'after').length === 0;
  
  return {
    claims,
    missingItems,
    riskFlags,
    exportReady
  };
}
