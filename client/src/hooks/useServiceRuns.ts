import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { useCallback, useMemo } from "react";

export interface ServiceRun {
  id: string;
  title: string;
  company_name: string;
  service_type: string;
  destination_region: string;
  scheduled_date: string;
  planned_duration_days?: number;
  total_job_slots?: number;
  slots_filled?: number;
  crew_size?: number;
  crew_name?: string;
  status: string;
  reservation_deadline?: string;
  notes?: string;
}

interface ServiceRunsResponse {
  ok: boolean;
  data?: { serviceRuns: ServiceRun[] };
  error?: { code: string; message: string };
}

interface FiltersResponse {
  ok: boolean;
  data?: { serviceTypes: string[]; statuses: string[] };
  error?: { code: string; message: string };
}

interface UseServiceRunsOptions {
  startDate?: string;
  endDate?: string;
  status?: string[];
  serviceType?: string[];
  search?: string;
}

export function useServiceRuns(options: UseServiceRunsOptions = {}) {
  const { startDate, endDate, status, serviceType, search } = options;

  const query = useQuery<ServiceRunsResponse>({
    queryKey: ["/api/p2/service-runs", { startDate, endDate, status, serviceType, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (status && status.length > 0) params.set("status", status.join(","));
      if (serviceType && serviceType.length > 0) params.set("serviceType", serviceType.join(","));
      if (search) params.set("search", search);

      const url = `/api/p2/service-runs${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  return {
    serviceRuns: query.data?.data?.serviceRuns || [],
    isLoading: query.isLoading,
    isError: query.isError || query.data?.ok === false,
    error: query.data?.error,
    refetch: query.refetch,
  };
}

export function useServiceRunFilters() {
  const query = useQuery<FiltersResponse>({
    queryKey: ["/api/p2/service-runs/filters"],
    queryFn: async () => {
      const res = await fetch("/api/p2/service-runs/filters", { credentials: "include" });
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    serviceTypes: query.data?.data?.serviceTypes || [],
    statuses: query.data?.data?.statuses || [],
    isLoading: query.isLoading,
  };
}

export function useServiceRunsCalendarFilters() {
  const [location, setLocation] = useLocation();

  const searchParams = useMemo(() => {
    const url = new URL(window.location.href);
    return url.searchParams;
  }, [location]);

  const currentMonth = useMemo(() => {
    const monthParam = searchParams.get("month");
    return monthParam ? new Date(monthParam + "-01") : new Date();
  }, [searchParams]);

  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const status = useMemo(() => searchParams.get("status")?.split(",").filter(Boolean) || [], [searchParams]);
  const serviceType = useMemo(() => searchParams.get("serviceType")?.split(",").filter(Boolean) || [], [searchParams]);
  const search = searchParams.get("search") || "";

  const updateParams = useCallback((updater: (params: URLSearchParams) => void) => {
    const newParams = new URLSearchParams(window.location.search);
    updater(newParams);
    const newSearch = newParams.toString();
    const newPath = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`;
    window.history.replaceState(null, "", newPath);
    setLocation(newPath);
  }, [setLocation]);

  const setMonth = useCallback((date: Date) => {
    updateParams((params) => params.set("month", format(date, "yyyy-MM")));
  }, [updateParams]);

  const nextMonth = useCallback(() => {
    setMonth(addMonths(currentMonth, 1));
  }, [currentMonth, setMonth]);

  const prevMonth = useCallback(() => {
    setMonth(subMonths(currentMonth, 1));
  }, [currentMonth, setMonth]);

  const setStatus = useCallback((values: string[]) => {
    updateParams((params) => {
      if (values.length > 0) {
        params.set("status", values.join(","));
      } else {
        params.delete("status");
      }
    });
  }, [updateParams]);

  const setServiceType = useCallback((values: string[]) => {
    updateParams((params) => {
      if (values.length > 0) {
        params.set("serviceType", values.join(","));
      } else {
        params.delete("serviceType");
      }
    });
  }, [updateParams]);

  const setSearch = useCallback((value: string) => {
    updateParams((params) => {
      if (value) {
        params.set("search", value);
      } else {
        params.delete("search");
      }
    });
  }, [updateParams]);

  const clearFilters = useCallback(() => {
    updateParams((params) => {
      params.delete("status");
      params.delete("serviceType");
      params.delete("search");
    });
  }, [updateParams]);

  return {
    currentMonth,
    startDate,
    endDate,
    status,
    serviceType,
    search,
    setMonth,
    nextMonth,
    prevMonth,
    setStatus,
    setServiceType,
    setSearch,
    clearFilters,
    hasActiveFilters: status.length > 0 || serviceType.length > 0 || search.length > 0,
  };
}
