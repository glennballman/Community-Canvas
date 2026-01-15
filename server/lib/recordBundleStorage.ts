/**
 * Record Bundle Storage Contract
 * 
 * Provides R2 key construction for defensive record bundles.
 * Actual R2 upload/download operations will be added in Prompt 2.
 */

/**
 * Build the R2 storage key for a bundle artifact.
 * 
 * Key format: bundles/{tenantId}/{bundleId}/{artifactType}/{fileName}
 * 
 * @param tenantId - UUID of the tenant
 * @param bundleId - UUID of the bundle
 * @param artifactType - Type of artifact (json, pdf, html, media, log_export, snapshot)
 * @param fileName - Original file name
 * @returns Storage key for R2
 */
export function buildR2KeyForBundle(
  tenantId: string,
  bundleId: string,
  artifactType: string,
  fileName: string
): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `bundles/${tenantId}/${bundleId}/${artifactType}/${safeFileName}`;
}

/**
 * Build the R2 storage key for a contemporaneous note media attachment.
 * 
 * Key format: notes/{tenantId}/{noteId}/{fileName}
 * 
 * @param tenantId - UUID of the tenant
 * @param noteId - UUID of the note
 * @param fileName - Original file name
 * @returns Storage key for R2
 */
export function buildR2KeyForNoteMedia(
  tenantId: string,
  noteId: string,
  fileName: string
): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `notes/${tenantId}/${noteId}/${safeFileName}`;
}

/**
 * Parse a bundle storage key to extract components.
 * 
 * @param storageKey - R2 storage key
 * @returns Parsed components or null if invalid format
 */
export function parseBundleStorageKey(storageKey: string): {
  tenantId: string;
  bundleId: string;
  artifactType: string;
  fileName: string;
} | null {
  const parts = storageKey.split('/');
  if (parts.length !== 5 || parts[0] !== 'bundles') {
    return null;
  }
  return {
    tenantId: parts[1],
    bundleId: parts[2],
    artifactType: parts[3],
    fileName: parts[4],
  };
}
