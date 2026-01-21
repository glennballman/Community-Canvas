/**
 * A2.7: Bundle Media ID Compatibility Layer
 * 
 * Handles backward compatibility where bundle arrays may contain:
 * - cc_media.id (new approach)
 * - cc_ai_ingestions.id (legacy approach)
 * 
 * This layer resolves any ID to its media metadata without breaking existing bundles.
 */

import { db } from '../../db';
import { cc_media, ccAiIngestions } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface ResolvedMediaItem {
  mediaId: string | null;
  ingestionId: string | null;
  capturedAt: Date | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
}

/**
 * Resolves a bundle item ID to its media metadata.
 * Handles both direct media IDs and ingestion IDs.
 */
export async function resolveBundleItemIdToMedia(itemId: string): Promise<ResolvedMediaItem> {
  // First, try to find as a media ID
  const media = await db.select().from(cc_media).where(eq(cc_media.id, itemId)).limit(1);
  
  if (media.length > 0) {
    const m = media[0];
    return {
      mediaId: m.id,
      ingestionId: null,
      capturedAt: m.capturedAt ? new Date(m.capturedAt) : null,
      lat: m.geoLat ? parseFloat(m.geoLat) : null,
      lng: m.geoLng ? parseFloat(m.geoLng) : null,
      url: m.publicUrl,
      mimeType: m.mimeType,
      width: m.width,
      height: m.height,
      fileSize: m.fileSize
    };
  }
  
  // Not found as media ID, try as ingestion ID
  const ingestion = await db.select().from(ccAiIngestions).where(eq(ccAiIngestions.id, itemId)).limit(1);
  
  if (ingestion.length > 0) {
    const ing = ingestion[0];
    const mediaArray = (ing.media || []) as Array<{
      url?: string;
      mime?: string;
      bytes?: number;
      width?: number;
      height?: number;
      captured_at?: string;
      lat?: number;
      lng?: number;
    }>;
    
    // Get the first media item from the ingestion
    const firstMedia = mediaArray[0];
    
    return {
      mediaId: null,
      ingestionId: ing.id,
      capturedAt: firstMedia?.captured_at ? new Date(firstMedia.captured_at) : ing.createdAt,
      lat: firstMedia?.lat ?? null,
      lng: firstMedia?.lng ?? null,
      url: firstMedia?.url ?? null,
      mimeType: firstMedia?.mime ?? null,
      width: firstMedia?.width ?? null,
      height: firstMedia?.height ?? null,
      fileSize: firstMedia?.bytes ?? null
    };
  }
  
  // Not found anywhere
  return {
    mediaId: null,
    ingestionId: null,
    capturedAt: null,
    lat: null,
    lng: null,
    url: null,
    mimeType: null,
    width: null,
    height: null,
    fileSize: null
  };
}

/**
 * Resolves an array of bundle item IDs to their media metadata.
 */
export async function resolveBundleItemsToMedia(itemIds: string[]): Promise<ResolvedMediaItem[]> {
  if (!itemIds || itemIds.length === 0) return [];
  
  const results = await Promise.all(itemIds.map(id => resolveBundleItemIdToMedia(id)));
  return results;
}

/**
 * Normalizes a bundle's arrays to just mediaIds for processing.
 * Does NOT modify the database - just returns normalized arrays.
 */
export async function normalizeBundleArraysToMediaIds(bundle: {
  beforeMediaIds: unknown;
  afterMediaIds: unknown;
  duringMediaIds?: unknown;
}): Promise<{
  beforeItems: ResolvedMediaItem[];
  afterItems: ResolvedMediaItem[];
  duringItems: ResolvedMediaItem[];
}> {
  const beforeIds = Array.isArray(bundle.beforeMediaIds) ? bundle.beforeMediaIds : [];
  const afterIds = Array.isArray(bundle.afterMediaIds) ? bundle.afterMediaIds : [];
  const duringIds = Array.isArray(bundle.duringMediaIds) ? bundle.duringMediaIds : [];
  
  const [beforeItems, afterItems, duringItems] = await Promise.all([
    resolveBundleItemsToMedia(beforeIds.map(String)),
    resolveBundleItemsToMedia(afterIds.map(String)),
    resolveBundleItemsToMedia(duringIds.map(String))
  ]);
  
  return { beforeItems, afterItems, duringItems };
}
