import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useLatestSnapshot(location: string = 'Bamfield') {
  return useQuery({
    queryKey: [api.snapshots.getLatest.path, location],
    queryFn: async () => {
      const url = `${api.snapshots.getLatest.path}?location=${encodeURIComponent(location)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch snapshot');
      }
      return api.snapshots.getLatest.responses[200].parse(await res.json());
    },
    refetchInterval: 1000 * 60 * 5, // Refresh every 5 minutes automatically
  });
}

export function useRefreshSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (location: string = 'Bamfield') => {
      const res = await fetch(api.snapshots.refresh.path, {
        method: api.snapshots.refresh.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location }),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to refresh data');
      }
      return await res.json();
    },
    onSuccess: (_, location) => {
      // Invalidate the query to fetch the new data
      queryClient.invalidateQueries({ 
        queryKey: [api.snapshots.getLatest.path, location] 
      });
    },
  });
}
