import { useQuery } from '@tanstack/react-query';

interface CompanyCamPhoto {
  id: string;
  url: string;
  thumbnailUrl: string;
  caption: string;
  timestamp: string;
  tags: string[];
  source: 'companycam';
}

interface CompanyCamProject {
  id: string;
  name: string;
  address?: {
    street_address_1?: string;
    city?: string;
    state?: string;
  };
}

export function useCompanyCamPhotos(projectId: string | null, limit: number = 10) {
  return useQuery<CompanyCamPhoto[]>({
    queryKey: ['/api/v1/integrations/companycam/project', projectId, 'photos', limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/integrations/companycam/project/${projectId}/photos?limit=${limit}`
      );
      if (!response.ok) throw new Error('Failed to fetch photos');
      return response.json();
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyCamSearch(query: string | null) {
  return useQuery<CompanyCamProject[]>({
    queryKey: ['/api/v1/integrations/companycam/search', query],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/integrations/companycam/search?q=${encodeURIComponent(query || '')}`
      );
      if (!response.ok) throw new Error('Failed to search projects');
      return response.json();
    },
    enabled: !!query && query.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCompanyCamStatus() {
  return useQuery<{ connected: boolean; projectCount?: number; error?: string }>({
    queryKey: ['/api/v1/integrations/companycam/test'],
    staleTime: 60 * 1000,
  });
}

export type { CompanyCamPhoto, CompanyCamProject };
