/**
 * Media API Helpers
 * M-2: Client-side functions for R2 media upload/download
 */

import { apiRequest } from './queryClient';

export interface MediaAsset {
  id: string;
  tenant_id: string;
  entity_type?: string;
  entity_id?: string;
  filename: string;
  content_type: string;
  size_bytes?: number;
  public_url: string;
  thumbnail_url?: string;
  role?: string;
  alt_text?: string;
  purpose?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PresignResponse {
  success: boolean;
  upload_url: string;
  media_id: string;
  public_url: string;
}

export interface PresignRequest {
  filename: string;
  contentType: string;
  entityType?: string;
  entityId?: string;
}

export interface CompleteRequest {
  mediaId: string;
  entityType?: string;
  entityId?: string;
  role?: string;
  altText?: string;
}

/**
 * Get a presigned URL for direct browser upload to R2
 */
export async function presignUpload(params: PresignRequest): Promise<PresignResponse> {
  const response = await apiRequest('POST', '/api/cc_media/presign', {
    filename: params.filename,
    content_type: params.contentType,
    entity_type: params.entityType,
    entity_id: params.entityId,
  });
  return response.json();
}

/**
 * Complete a presigned upload after the file has been uploaded to R2
 */
export async function completeUpload(params: CompleteRequest): Promise<{ success: boolean }> {
  const response = await apiRequest('POST', `/api/cc_media/${params.mediaId}/complete`, {
    entity_type: params.entityType,
    entity_id: params.entityId,
    role: params.role,
    alt_text: params.altText,
  });
  return response.json();
}

/**
 * Fetch all media assets for a given entity
 */
export async function fetchEntityMedia(
  entityType: string,
  entityId: string,
  role?: string
): Promise<{ success: boolean; cc_media: MediaAsset[]; count: number }> {
  const url = role 
    ? `/api/cc_media/entity/${entityType}/${entityId}?role=${encodeURIComponent(role)}`
    : `/api/cc_media/entity/${entityType}/${entityId}`;
  
  const response = await fetch(url, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch media');
  }
  
  return response.json();
}

/**
 * Fetch a single media asset by ID
 */
export async function fetchMedia(mediaId: string): Promise<{ success: boolean; cc_media: MediaAsset }> {
  const response = await fetch(`/api/cc_media/${mediaId}`, {
    credentials: 'include',
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch media');
  }
  
  return response.json();
}

/**
 * Delete a media asset
 */
export async function deleteMedia(mediaId: string): Promise<{ success: boolean }> {
  const response = await apiRequest('DELETE', `/api/cc_media/${mediaId}`);
  return response.json();
}

/**
 * Upload a file to R2 using XMLHttpRequest for progress tracking
 */
async function uploadToR2WithProgress(
  url: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed due to network error'));
    });
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'));
    });
    
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

/**
 * Upload a file directly to R2 using presigned URL
 * Returns the completed media asset
 */
export async function uploadFileToR2(
  file: File,
  options?: {
    entityType?: string;
    entityId?: string;
    role?: string;
    altText?: string;
    onProgress?: (progress: number) => void;
  }
): Promise<MediaAsset> {
  // Step 1: Get presigned URL
  const presignResult = await presignUpload({
    filename: file.name,
    contentType: file.type,
    entityType: options?.entityType,
    entityId: options?.entityId,
  });

  if (!presignResult.success) {
    throw new Error('Failed to get presigned URL');
  }

  // Step 2: Upload directly to R2 with progress tracking
  await uploadToR2WithProgress(
    presignResult.upload_url,
    file,
    options?.onProgress
  );

  // Step 3: Complete the upload
  const completeResult = await completeUpload({
    mediaId: presignResult.media_id,
    entityType: options?.entityType,
    entityId: options?.entityId,
    role: options?.role,
    altText: options?.altText,
  });

  if (!completeResult.success) {
    throw new Error('Failed to complete upload');
  }

  // Step 4: Fetch the completed media asset
  const mediaResult = await fetchMedia(presignResult.media_id);
  
  if (!mediaResult.success) {
    throw new Error('Failed to fetch uploaded media');
  }

  return mediaResult.cc_media;
}
