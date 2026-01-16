/**
 * P2.8 Client-Side Offline Queue Library
 * 
 * Provides persistent queue for evidence capture during low/no connectivity.
 * Syncs evidence when connectivity is restored using idempotent APIs.
 */

import { nanoid } from 'nanoid';

// Queue item states
export type QueueItemStatus = 'queued' | 'uploading' | 'synced' | 'failed';

// Supported evidence source types
export type OfflineSourceType = 'manual_note' | 'file_r2' | 'url_snapshot' | 'json_snapshot';

// Queue item structure
export interface OfflineQueueItem {
  localId: string;
  clientRequestId: string;
  batchClientRequestId: string | null;
  deviceId: string;
  status: QueueItemStatus;
  createdAtDevice: string; // ISO timestamp
  occurredAtDevice: string | null;
  capturedAtDevice: string | null;
  sourceType: OfflineSourceType;
  title: string;
  description: string | null;
  circleId: string | null;
  portalId: string | null;
  contentSha256: string | null; // Client-computed hash if available
  contentMime: string | null;
  payload: Record<string, unknown>;
  retryCount: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  evidenceObjectId: string | null; // Set after successful sync
}

// Batch structure for sync
export interface OfflineBatch {
  batchClientRequestId: string;
  deviceId: string;
  batchCreatedAt: string;
  items: OfflineQueueItem[];
}

// Sync result from server
export interface SyncResult {
  clientRequestId: string;
  status: 'created_new' | 'already_applied' | 'rejected';
  evidenceObjectId?: string;
  reason?: string;
}

// Storage keys
const STORAGE_KEY = 'cc_offline_queue';
const DEVICE_ID_KEY = 'cc_device_id';
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Get or create a stable device ID for this installation
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${nanoid(16)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Get all items from the queue
 */
export function getQueueItems(): OfflineQueueItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as OfflineQueueItem[];
  } catch {
    return [];
  }
}

/**
 * Save items to the queue
 */
function saveQueueItems(items: OfflineQueueItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/**
 * Add an item to the offline queue
 */
export function enqueue(params: {
  sourceType: OfflineSourceType;
  title: string;
  description?: string;
  occurredAt?: Date;
  circleId?: string;
  portalId?: string;
  contentSha256?: string;
  contentMime?: string;
  payload: Record<string, unknown>;
}): OfflineQueueItem {
  const now = new Date().toISOString();
  const deviceId = getDeviceId();
  
  const item: OfflineQueueItem = {
    localId: nanoid(),
    clientRequestId: nanoid(),
    batchClientRequestId: null,
    deviceId,
    status: 'queued',
    createdAtDevice: now,
    occurredAtDevice: params.occurredAt?.toISOString() ?? null,
    capturedAtDevice: now,
    sourceType: params.sourceType,
    title: params.title,
    description: params.description ?? null,
    circleId: params.circleId ?? null,
    portalId: params.portalId ?? null,
    contentSha256: params.contentSha256 ?? null,
    contentMime: params.contentMime ?? null,
    payload: params.payload,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
    evidenceObjectId: null,
  };
  
  const items = getQueueItems();
  items.push(item);
  saveQueueItems(items);
  
  return item;
}

/**
 * Update an item in the queue
 */
export function updateQueueItem(
  localId: string,
  updates: Partial<OfflineQueueItem>
): OfflineQueueItem | null {
  const items = getQueueItems();
  const index = items.findIndex(i => i.localId === localId);
  if (index === -1) return null;
  
  items[index] = { ...items[index], ...updates };
  saveQueueItems(items);
  return items[index];
}

/**
 * Remove an item from the queue
 */
export function dequeue(localId: string): boolean {
  const items = getQueueItems();
  const filtered = items.filter(i => i.localId !== localId);
  if (filtered.length === items.length) return false;
  saveQueueItems(filtered);
  return true;
}

/**
 * Get items that are ready for sync (queued or failed with retries remaining)
 */
export function getPendingItems(): OfflineQueueItem[] {
  return getQueueItems().filter(item => {
    if (item.status === 'queued') return true;
    if (item.status === 'failed' && item.retryCount < MAX_RETRY_ATTEMPTS) return true;
    return false;
  });
}

/**
 * Create a batch from pending items
 */
export function createBatch(): OfflineBatch | null {
  const pending = getPendingItems();
  if (pending.length === 0) return null;
  
  const batchId = nanoid();
  const deviceId = getDeviceId();
  
  // Mark items as part of this batch
  for (const item of pending) {
    updateQueueItem(item.localId, { 
      batchClientRequestId: batchId,
      status: 'uploading',
      lastAttemptAt: new Date().toISOString()
    });
  }
  
  return {
    batchClientRequestId: batchId,
    deviceId,
    batchCreatedAt: new Date().toISOString(),
    items: pending.map(item => ({ ...item, batchClientRequestId: batchId }))
  };
}

/**
 * Apply sync results to the queue
 */
export function applySyncResults(results: SyncResult[]): void {
  const items = getQueueItems();
  
  for (const result of results) {
    const index = items.findIndex(i => i.clientRequestId === result.clientRequestId);
    if (index === -1) continue;
    
    if (result.status === 'created_new' || result.status === 'already_applied') {
      items[index] = {
        ...items[index],
        status: 'synced',
        evidenceObjectId: result.evidenceObjectId ?? null,
        lastError: null
      };
    } else if (result.status === 'rejected') {
      items[index] = {
        ...items[index],
        status: 'failed',
        retryCount: items[index].retryCount + 1,
        lastError: result.reason ?? 'Unknown rejection reason'
      };
    }
  }
  
  saveQueueItems(items);
}

/**
 * Mark items as failed (for network errors during sync)
 */
export function markBatchFailed(batchClientRequestId: string, error: string): void {
  const items = getQueueItems();
  
  for (let i = 0; i < items.length; i++) {
    if (items[i].batchClientRequestId === batchClientRequestId) {
      items[i] = {
        ...items[i],
        status: 'failed',
        retryCount: items[i].retryCount + 1,
        lastError: error
      };
    }
  }
  
  saveQueueItems(items);
}

/**
 * Calculate retry delay with exponential backoff
 */
export function getRetryDelay(retryCount: number): number {
  return Math.min(
    RETRY_BASE_DELAY_MS * Math.pow(2, retryCount),
    60000 // Max 1 minute
  );
}

/**
 * Clear synced items from queue
 */
export function clearSyncedItems(): number {
  const items = getQueueItems();
  const remaining = items.filter(i => i.status !== 'synced');
  const cleared = items.length - remaining.length;
  saveQueueItems(remaining);
  return cleared;
}

/**
 * Get queue statistics
 */
export function getQueueStats(): {
  total: number;
  queued: number;
  uploading: number;
  synced: number;
  failed: number;
} {
  const items = getQueueItems();
  return {
    total: items.length,
    queued: items.filter(i => i.status === 'queued').length,
    uploading: items.filter(i => i.status === 'uploading').length,
    synced: items.filter(i => i.status === 'synced').length,
    failed: items.filter(i => i.status === 'failed').length,
  };
}

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Listen for network status changes
 */
export function onNetworkChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Compute SHA-256 hash of content (for text/JSON payloads)
 */
export async function computeSha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Canonicalize JSON for deterministic hashing
 */
export function canonicalizeJson(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}
