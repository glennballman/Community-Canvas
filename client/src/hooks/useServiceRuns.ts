import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { useCallback, useState, useEffect } from "react";

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

function getInitialMonth(): Date {
  const params = new URLSearchParams(window.location.search);
  const monthParam = params.get("month");
  return monthParam ? new Date(monthParam + "-01") : new Date();
}

function getInitialFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    status: params.get("status")?.split(",").filter(Boolean) || [],
    serviceType: params.get("serviceType")?.split(",").filter(Boolean) || [],
    search: params.get("search") || "",
  };
}

export function useServiceRunsCalendarFilters() {
  const [currentMonth, setCurrentMonth] = useState<Date>(getInitialMonth);
  const [status, setStatusState] = useState<string[]>(() => getInitialFilters().status);
  const [serviceType, setServiceTypeState] = useState<string[]>(() => getInitialFilters().serviceType);
  const [search, setSearchState] = useState<string>(() => getInitialFilters().search);

  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const updateUrl = useCallback((month: Date, s: string[], st: string[], srch: string) => {
    const params = new URLSearchParams();
    params.set("month", format(month, "yyyy-MM"));
    if (s.length > 0) params.set("status", s.join(","));
    if (st.length > 0) params.set("serviceType", st.join(","));
    if (srch) params.set("search", srch);
    const newPath = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newPath);
  }, []);

  useEffect(() => {
    updateUrl(currentMonth, status, serviceType, search);
  }, [currentMonth, status, serviceType, search, updateUrl]);

  const setMonth = useCallback((date: Date) => {
    setCurrentMonth(date);
  }, []);

  const nextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1));
  }, []);

  const prevMonth = useCallback(() => {
    setCurrentMonth(prev => subMonths(prev, 1));
  }, []);

  const setStatus = useCallback((values: string[]) => {
    setStatusState(values);
  }, []);

  const setServiceType = useCallback((values: string[]) => {
    setServiceTypeState(values);
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
  }, []);

  const clearFilters = useCallback(() => {
    setStatusState([]);
    setServiceTypeState([]);
    setSearchState("");
  }, []);

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
