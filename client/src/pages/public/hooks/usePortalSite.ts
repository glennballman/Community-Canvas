import { useQuery } from '@tanstack/react-query';

export function usePortalSite(portalSlug?: string) {
  const query = useQuery({
    queryKey: portalSlug
      ? [`/api/public/cc_portals/${portalSlug}/site`]
      : ['portal-site', 'none'],
    queryFn: async () => {
      if (!portalSlug) return null;
      const res = await fetch(`/api/public/cc_portals/${portalSlug}/site`);
      if (!res.ok) throw new Error('Failed to load portal site');
      return res.json();
    },
    enabled: !!portalSlug,
  });

  return {
    ...query,
    portal: query.data?.portal,
    theme: query.data?.theme,
    site: query.data?.site,
  };
}
