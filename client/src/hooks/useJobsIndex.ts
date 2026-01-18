import { useQuery, useMutation } from "@tanstack/react-query";
import { useCallback, useState, useEffect } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";

export interface Portal {
  id: string;
  name: string;
  slug: string;
}

export interface Job {
  id: string;
  title: string;
  role_category: string;
  employment_type: string;
  location_text?: string;
  status: string;
  urgency?: string;
  created_at: string;
  updated_at?: string;
  total_applications: number;
  active_postings: number;
  portals: Portal[] | null;
}

interface JobsResponse {
  ok: boolean;
  data?: { jobs: Job[]; total: number; limit: number; offset: number };
  error?: { code: string; message: string };
}

interface PortalsResponse {
  ok: boolean;
  data?: { portals: Portal[] };
  error?: { code: string; message: string };
}

interface UseJobsIndexOptions {
  status?: string;
  q?: string;
  portalId?: string;
  limit?: number;
  offset?: number;
}

export function useJobsIndex(options: UseJobsIndexOptions = {}) {
  const { status, q, portalId, limit = 50, offset = 0 } = options;

  const query = useQuery<JobsResponse>({
    queryKey: ["/api/p2/app/jobs", { status, q, portalId, limit, offset }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      if (portalId) params.set("portalId", portalId);
      params.set("limit", String(limit));
      params.set("offset", String(offset));

      const url = `/api/p2/app/jobs?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  return {
    jobs: query.data?.data?.jobs || [],
    total: query.data?.data?.total || 0,
    isLoading: query.isLoading,
    isError: query.isError || query.data?.ok === false,
    error: query.data?.error,
    refetch: query.refetch,
  };
}

export function useCloseJob() {
  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/p2/app/jobs/${jobId}/close`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2/app/jobs"] });
    },
  });
}

export function useJobPortals() {
  const query = useQuery<PortalsResponse>({
    queryKey: ["/api/p2/app/portals"],
    queryFn: async () => {
      const res = await fetch("/api/p2/app/portals", { credentials: "include" });
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    portals: query.data?.data?.portals || [],
    isLoading: query.isLoading,
  };
}

function getInitialFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    status: params.get("status") || "",
    q: params.get("q") || "",
    portalId: params.get("portalId") || "",
  };
}

export function useJobsIndexFilters() {
  const [status, setStatusState] = useState<string>(() => getInitialFilters().status);
  const [q, setQState] = useState<string>(() => getInitialFilters().q);
  const [portalId, setPortalIdState] = useState<string>(() => getInitialFilters().portalId);

  const updateUrl = useCallback((s: string, query: string, pId: string) => {
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (query) params.set("q", query);
    if (pId) params.set("portalId", pId);
    const newPath = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", newPath);
  }, []);

  useEffect(() => {
    updateUrl(status, q, portalId);
  }, [status, q, portalId, updateUrl]);

  const setStatus = useCallback((value: string) => {
    setStatusState(value);
  }, []);

  const setQ = useCallback((value: string) => {
    setQState(value);
  }, []);

  const setPortalId = useCallback((value: string) => {
    setPortalIdState(value);
  }, []);

  const clearFilters = useCallback(() => {
    setStatusState("");
    setQState("");
    setPortalIdState("");
  }, []);

  return {
    status,
    q,
    portalId,
    setStatus,
    setQ,
    setPortalId,
    clearFilters,
    hasActiveFilters: status !== "" || q !== "" || portalId !== "",
  };
}
