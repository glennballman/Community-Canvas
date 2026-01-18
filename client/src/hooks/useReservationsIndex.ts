import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface ReservationFilters {
  q?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  upcomingOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ReservationRow {
  id: string;
  status: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  unitName: string;
  confirmationNumber: string | null;
}

interface ReservationsResponse {
  ok: boolean;
  error?: { code: string; message: string };
  reservations: ReservationRow[];
  total: number;
  page: number;
  pageSize: number;
}

function mapReservation(r: any): ReservationRow {
  return {
    id: r.id,
    status: r.status || "pending",
    guestName: r.guest_name || r.guestName || r.primary_guest_name || r.guest?.name || "Guest",
    checkIn: r.check_in_date || r.checkInDate || r.start_at || "",
    checkOut: r.check_out_date || r.checkOutDate || r.end_at || "",
    unitName: r.unit_name || r.unitName || r.unit?.name || r.asset_name || "—",
    confirmationNumber: r.confirmation_number || r.confirmationNumber || null,
  };
}

export function useReservationsIndex(filters: ReservationFilters = {}) {
  const { q, status, startDate, endDate, upcomingOnly = true, page = 1, pageSize = 20 } = filters;

  const queryParams = new URLSearchParams();
  if (q) queryParams.set("q", q);
  if (status && status !== "all") queryParams.set("status", status);
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  queryParams.set("upcomingOnly", String(upcomingOnly));
  queryParams.set("page", String(page));
  queryParams.set("pageSize", String(pageSize));

  const queryString = queryParams.toString();

  const query = useQuery<ReservationsResponse>({
    queryKey: ["/api/p2/reservations", queryString],
    queryFn: async () => {
      const res = await fetch(`/api/p2/reservations?${queryString}`);
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error?.message || "Failed to fetch reservations");
      }
      return {
        ...data,
        reservations: (data.reservations || []).map(mapReservation),
      };
    },
  });

  return {
    reservations: query.data?.reservations || [],
    total: query.data?.total || 0,
    page: query.data?.page || 1,
    pageSize: query.data?.pageSize || 20,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useReservationCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/p2/reservations/${id}/check-in`);
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error?.message || "Check-in failed");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2/reservations"] });
    },
  });
}

export function useReservationCheckOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/p2/reservations/${id}/check-out`);
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error?.message || "Check-out failed");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2/reservations"] });
    },
  });
}
