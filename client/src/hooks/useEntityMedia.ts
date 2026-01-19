/**
 * Entity Media Hooks
 * M-2: React Query hooks for entity media management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchEntityMedia, deleteMedia, uploadFileToR2, type MediaAsset } from '@/lib/mediaApi';

/**
 * Hook to fetch media assets for an entity
 */
export function useEntityMedia(entityType: string, entityId: string, role?: string) {
  return useQuery({
    queryKey: ['entity-media', entityType, entityId, role],
    queryFn: async () => {
      const result = await fetchEntityMedia(entityType, entityId, role);
      return result.cc_media;
    },
    enabled: !!entityType && !!entityId,
  });
}

/**
 * Hook to upload files to an entity
 */
export function useUploadToEntity(entityType: string, entityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      role,
      altText,
    }: {
      file: File;
      role?: string;
      altText?: string;
    }) => {
      return uploadFileToR2(file, {
        entityType,
        entityId,
        role,
        altText,
      });
    },
    onSuccess: () => {
      // Invalidate all entity-media queries for this entity (including role-filtered variants)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === 'entity-media' &&
            key[1] === entityType &&
            key[2] === entityId
          );
        },
      });
    },
  });
}

/**
 * Hook to delete media and invalidate entity cache
 */
export function useDeleteEntityMedia(entityType: string, entityId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mediaId: string) => {
      const result = await deleteMedia(mediaId);
      if (!result.success) {
        throw new Error('Failed to delete media');
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate all entity-media queries for this entity (including role-filtered variants)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey;
          return (
            Array.isArray(key) &&
            key[0] === 'entity-media' &&
            key[1] === entityType &&
            key[2] === entityId
          );
        },
      });
    },
  });
}

/**
 * Combined hook for entity media management
 */
export function useEntityMediaManager(entityType: string, entityId: string) {
  const mediaQuery = useEntityMedia(entityType, entityId);
  const uploadMutation = useUploadToEntity(entityType, entityId);
  const deleteMutation = useDeleteEntityMedia(entityType, entityId);

  return {
    assets: mediaQuery.data ?? [],
    isLoading: mediaQuery.isLoading,
    isError: mediaQuery.isError,
    error: mediaQuery.error,
    refetch: mediaQuery.refetch,
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    delete: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
