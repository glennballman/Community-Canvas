import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { nanoid } from 'nanoid';
import { pool } from '../db.js';

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'community-canvas-media';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

// Check if R2 is configured
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

// Create R2 client (lazy initialization)
let r2Client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2Client) {
    if (!isR2Configured()) {
      throw new Error('R2 storage is not configured. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY environment variables.');
    }
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2Client;
}

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

export interface UploadOptions {
  tenantId: string;
  entityType?: string;
  entityId?: string;
  role?: string;
  altText?: string;
  purpose?: string;
  uploadedBy?: string;
}

export interface MediaUploadResult {
  id: string;
  publicUrl: string;
  thumbnail?: string;
  medium?: string;
  width?: number;
  height?: number;
  filename: string;
  mimeType: string;
  fileSize: number;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  mediaId: string;
  publicUrl: string;
  storageKey: string;
}

// Generate storage key path
function generateStorageKey(tenantId: string, entityType: string, entityId: string, filename: string): string {
  const ext = filename.split('.').pop() || 'bin';
  const uniqueFilename = `${nanoid(12)}.${ext}`;
  return `tenants/${tenantId}/${entityType}/${entityId}/${uniqueFilename}`;
}

// Upload buffer to R2
async function uploadToR2(key: string, buffer: Buffer, contentType: string): Promise<void> {
  const client = getR2Client();
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000', // 1 year cache
  }));
}

// Delete from R2
async function deleteFromR2(key: string): Promise<void> {
  const client = getR2Client();
  await client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }));
}

// Get public URL for a storage key
function getPublicUrl(storageKey: string): string {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${storageKey}`;
  }
  // Fallback to R2.dev URL
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.dev/${storageKey}`;
}

// Process image and create variants
async function processImage(buffer: Buffer): Promise<{
  processed: Buffer;
  thumbnail?: Buffer;
  medium?: Buffer;
  width?: number;
  height?: number;
}> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  
  // Optimize original (max 2000px, quality 85)
  const processed = await image
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  
  // Create thumbnail (400px cover crop)
  const thumbnail = await sharp(buffer)
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer();
  
  // Create medium (800px)
  const medium = await sharp(buffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  
  return {
    processed,
    thumbnail,
    medium,
    width: metadata.width,
    height: metadata.height,
  };
}

// Upload media file directly
export async function uploadMedia(
  file: { buffer: Buffer; originalname: string; mimetype: string },
  options: UploadOptions
): Promise<MediaUploadResult> {
  const { tenantId, entityType = 'general', entityId = 'misc', role = 'gallery', altText, purpose, uploadedBy } = options;
  
  // Validate file type
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    throw new Error(`File type ${file.mimetype} not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`);
  }
  
  // Generate storage key
  const storageKey = generateStorageKey(tenantId, entityType, entityId, file.originalname);
  
  let processedBuffer = file.buffer;
  let width: number | undefined;
  let height: number | undefined;
  let finalMimeType = file.mimetype;
  const variants: Record<string, string> = {};
  
  // Process images (not GIFs to preserve animation)
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) && file.mimetype !== 'image/gif') {
    const processed = await processImage(file.buffer);
    processedBuffer = processed.processed;
    width = processed.width;
    height = processed.height;
    // Processed images are always JPEG
    finalMimeType = 'image/jpeg';
    
    // Upload thumbnail
    if (processed.thumbnail) {
      const thumbnailKey = storageKey.replace(/\.[^.]+$/, '_thumb.jpg');
      await uploadToR2(thumbnailKey, processed.thumbnail, 'image/jpeg');
      variants.thumbnail = getPublicUrl(thumbnailKey);
    }
    
    // Upload medium
    if (processed.medium) {
      const mediumKey = storageKey.replace(/\.[^.]+$/, '_medium.jpg');
      await uploadToR2(mediumKey, processed.medium, 'image/jpeg');
      variants.medium = getPublicUrl(mediumKey);
    }
  }
  
  // Upload main file with correct MIME type (JPEG for processed images)
  await uploadToR2(storageKey, processedBuffer, finalMimeType);
  const publicUrl = getPublicUrl(storageKey);
  
  // Save to database with the actual MIME type of the stored file
  const mediaType = ALLOWED_IMAGE_TYPES.includes(file.mimetype) ? 'image' : 'document';
  
  const result = await pool.query(`
    INSERT INTO media (
      tenant_id, storage_key, storage_provider, public_url,
      filename, mime_type, file_size, width, height,
      alt_text, media_type, purpose, source, variants, uploaded_by
    ) VALUES ($1, $2, 'r2', $3, $4, $5, $6, $7, $8, $9, $10, $11, 'upload', $12, $13)
    RETURNING id
  `, [
    tenantId, storageKey, publicUrl,
    file.originalname, finalMimeType, processedBuffer.length,
    width, height, altText, mediaType, purpose || role,
    JSON.stringify(variants), uploadedBy
  ]);
  
  const mediaId = result.rows[0].id;
  
  // Link to entity if provided
  if (entityType !== 'general' && entityId !== 'misc') {
    await pool.query(`
      INSERT INTO entity_media (media_id, entity_type, entity_id, role)
      VALUES ($1, $2, $3, $4)
    `, [mediaId, entityType, entityId, role]);
  }
  
  return {
    id: mediaId,
    publicUrl,
    thumbnail: variants.thumbnail,
    medium: variants.medium,
    width,
    height,
    filename: file.originalname,
    mimeType: finalMimeType,
    fileSize: processedBuffer.length,
  };
}

// Get presigned URL for direct browser upload
export async function getPresignedUploadUrl(
  tenantId: string,
  filename: string,
  contentType: string,
  entityType = 'general',
  entityId = 'misc'
): Promise<PresignedUploadResult> {
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`File type ${contentType} not allowed`);
  }
  
  const client = getR2Client();
  const storageKey = generateStorageKey(tenantId, entityType, entityId, filename);
  
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storageKey,
    ContentType: contentType,
  });
  
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
  const publicUrl = getPublicUrl(storageKey);
  
  // Create pending media record
  const result = await pool.query(`
    INSERT INTO media (
      tenant_id, storage_key, storage_provider, public_url,
      filename, mime_type, file_size, media_type, source, processing_status
    ) VALUES ($1, $2, 'r2', $3, $4, $5, 0, $6, 'upload', 'pending')
    RETURNING id
  `, [
    tenantId, storageKey, publicUrl, filename, contentType,
    ALLOWED_IMAGE_TYPES.includes(contentType) ? 'image' : 'document'
  ]);
  
  return {
    uploadUrl,
    mediaId: result.rows[0].id,
    publicUrl,
    storageKey,
  };
}

// Complete presigned upload (called after browser uploads directly)
export async function completePresignedUpload(
  mediaId: string,
  tenantId: string,
  options: { entityType?: string; entityId?: string; role?: string; altText?: string }
): Promise<void> {
  const { entityType, entityId, role = 'gallery', altText } = options;
  
  // Get media record
  const mediaResult = await pool.query(
    'SELECT storage_key, mime_type FROM media WHERE id = $1 AND tenant_id = $2',
    [mediaId, tenantId]
  );
  
  if (mediaResult.rows.length === 0) {
    throw new Error('Media not found');
  }
  
  const { storage_key, mime_type } = mediaResult.rows[0];
  
  // Get file size from R2
  const client = getR2Client();
  const headResponse = await client.send(new HeadObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: storage_key,
  }));
  
  // Update media record
  await pool.query(`
    UPDATE media SET
      file_size = $1,
      alt_text = $2,
      processing_status = 'complete',
      updated_at = now()
    WHERE id = $3
  `, [headResponse.ContentLength || 0, altText, mediaId]);
  
  // Link to entity if provided
  if (entityType && entityId) {
    await pool.query(`
      INSERT INTO entity_media (media_id, entity_type, entity_id, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [mediaId, entityType, entityId, role]);
  }
}

// Get media for an entity
export async function getMediaForEntity(
  entityType: string,
  entityId: string,
  role?: string
): Promise<Array<{
  id: string;
  publicUrl: string;
  thumbnail: string | null;
  medium: string | null;
  filename: string;
  altText: string | null;
  role: string;
  sortOrder: number;
}>> {
  let query = `
    SELECT 
      m.id,
      m.public_url as "publicUrl",
      m.variants->>'thumbnail' as thumbnail,
      m.variants->>'medium' as medium,
      m.filename,
      m.alt_text as "altText",
      em.role,
      em.sort_order as "sortOrder"
    FROM entity_media em
    JOIN media m ON m.id = em.media_id
    WHERE em.entity_type = $1 AND em.entity_id = $2
  `;
  
  const params: (string | undefined)[] = [entityType, entityId];
  
  if (role) {
    query += ' AND em.role = $3';
    params.push(role);
  }
  
  query += ' ORDER BY em.sort_order, em.created_at';
  
  const result = await pool.query(query, params);
  return result.rows;
}

// Get single media by ID
export async function getMediaById(mediaId: string): Promise<{
  id: string;
  publicUrl: string;
  thumbnail: string | null;
  medium: string | null;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
  caption: string | null;
} | null> {
  const result = await pool.query(`
    SELECT 
      id,
      public_url as "publicUrl",
      variants->>'thumbnail' as thumbnail,
      variants->>'medium' as medium,
      filename,
      mime_type as "mimeType",
      width,
      height,
      alt_text as "altText",
      caption
    FROM media
    WHERE id = $1
  `, [mediaId]);
  
  return result.rows[0] || null;
}

// Delete media
export async function deleteMedia(mediaId: string, tenantId: string): Promise<void> {
  // Get media record
  const result = await pool.query(
    'SELECT storage_key, variants FROM media WHERE id = $1 AND tenant_id = $2',
    [mediaId, tenantId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Media not found');
  }
  
  const { storage_key, variants } = result.rows[0];
  
  // Delete from R2
  await deleteFromR2(storage_key);
  
  // Delete variants
  if (variants) {
    for (const variantUrl of Object.values(variants as Record<string, string>)) {
      if (variantUrl) {
        const variantKey = variantUrl.replace(R2_PUBLIC_URL + '/', '');
        try {
          await deleteFromR2(variantKey);
        } catch (e) {
          console.warn('Failed to delete variant:', variantKey);
        }
      }
    }
  }
  
  // Delete from database (cascades to entity_media)
  await pool.query('DELETE FROM media WHERE id = $1', [mediaId]);
}

// Queue crawled image for download
export async function queueCrawledImage(
  tenantId: string,
  sourceUrl: string,
  options: {
    sourcePageUrl?: string;
    entityType?: string;
    entityId?: string;
    suggestedRole?: string;
    suggestedAltText?: string;
    pageContext?: string;
    crawlJobId?: string;
  }
): Promise<string> {
  const result = await pool.query(`
    INSERT INTO crawl_media_queue (
      tenant_id, source_url, source_page_url, entity_type, entity_id,
      suggested_role, suggested_alt_text, page_context, crawl_job_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (source_url, entity_type, entity_id) DO UPDATE SET
      status = 'pending',
      error_message = NULL,
      processed_at = NULL
    RETURNING id
  `, [
    tenantId,
    options.sourcePageUrl,
    sourceUrl,
    options.entityType,
    options.entityId,
    options.suggestedRole || 'gallery',
    options.suggestedAltText,
    options.pageContext,
    options.crawlJobId
  ]);
  
  return result.rows[0].id;
}
