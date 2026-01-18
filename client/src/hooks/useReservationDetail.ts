import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface ReservationDetail {
  id: string;
  status: string;
  confirmation_number?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  unit_id?: string | null;
  unit_name?: string | null;
  asset_name?: string | null;
  portal_id?: string;
  created_at?: string;
  updated_at?: string;
  notes_summary?: string | null;
  party_size?: number | null;
  guest_count?: number | null;
  vehicle_plate?: string | null;
  vessel_name?: string | null;
  vessel_length_ft?: number | null;
  source?: string | null;
  guest_notes?: string | null;
  expected_arrival_time?: string | null;
  actual_arrival_time?: string | null;
  cancellation_reason?: string | null;
}

export interface TimelineEntry {
  id: string;
  type: string;
  title: string;
  at: string;
  detail?: string | null;
}

export interface ReservationDetailResponse {
  ok: boolean;
  error?: { code: string; message: string };
  reservation?: ReservationDetail;
  allocations?: any[];
  timeline?: TimelineEntry[];
}

type NormalizedStatus = 
  | "pending"
  | "confirmed"
  | "pending_arrival"
  | "checked_in"
  | "in_house"
  | "checked_out"
  | "completed"
  | "cancelled"
  | "unknown";

export function normalizeReservationStatus(status: string): NormalizedStatus {
  const normalized = status?.toLowerCase()?.replace(/[-_\s]/g, "_") || "unknown";
  
  const statusMap: Record<string, NormalizedStatus> = {
    pending: "pending",
    confirmed: "confirmed",
    pending_arrival: "pending_arrival",
    checked_in: "checked_in",
    in_house: "in_house",
    checked_out: "checked_out",
    completed: "completed",
    cancelled: "cancelled",
    canceled: "cancelled",
  };
  
  return statusMap[normalized] || "unknown";
}

export function canCheckIn(status: string): boolean {
  const normalized = normalizeReservationStatus(status);
  return normalized === "confirmed" || normalized === "pending_arrival";
}

export function canCheckOut(status: string): boolean {
  const normalized = normalizeReservationStatus(status);
  return normalized === "checked_in" || normalized === "in_house";
}

export function useReservationDetail(id: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<ReservationDetailResponse>({
    queryKey: ["/api/p2/reservations/detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/p2/reservations/${id}`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error || { code: "ERROR", message: "Failed to load" } };
      }
      return res.json();
    },
    enabled: !!id,
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/p2/reservations/${id}/check-in`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2/reservations/detail", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/p2/reservations"] });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/p2/reservations/${id}/check-out`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2/reservations/detail", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/p2/reservations"] });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/p2/reservations/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        return { ok: false, error: data.error || { code: "ERROR", message: "Failed to add note" } };
      }
      return data;
    },
    onSuccess: (data) => {
      if (data?.ok !== false) {
        queryClient.invalidateQueries({ queryKey: ["/api/p2/reservations/detail", id] });
      }
    },
  });

  const requestChangeMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/p2/reservations/${id}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        return { ok: false, error: data.error || { code: "ERROR", message: "Failed to submit request" } };
      }
      return data;
    },
    onSuccess: (data) => {
      if (data?.ok !== false) {
        queryClient.invalidateQueries({ queryKey: ["/api/p2/reservations/detail", id] });
      }
    },
  });

  const requestCancelMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch(`/api/p2/reservations/${id}/cancel-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        return { ok: false, error: data.error || { code: "ERROR", message: "Failed to submit request" } };
      }
      return data;
    },
    onSuccess: (data) => {
      if (data?.ok !== false) {
        queryClient.invalidateQueries({ queryKey: ["/api/p2/reservations/detail", id] });
      }
    },
  });

  const reservation = query.data?.reservation;
  const timeline = query.data?.timeline || [];
  const allocations = query.data?.allocations || [];

  const checkInDate = reservation?.check_in_date || reservation?.start_at;
  const checkOutDate = reservation?.check_out_date || reservation?.end_at;
  const unitLabel = reservation?.unit_name || reservation?.asset_name || "—";
  const partySize = reservation?.party_size || reservation?.guest_count;

  return {
    reservation,
    timeline,
    allocations,
    checkInDate,
    checkOutDate,
    unitLabel,
    partySize,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    notFound: query.data?.ok === false && query.data?.error?.code === "NOT_FOUND",
    refetch: query.refetch,
    checkIn: checkInMutation,
    checkOut: checkOutMutation,
    addNote: addNoteMutation,
    requestChange: requestChangeMutation,
    requestCancel: requestCancelMutation,
    canCheckIn: reservation ? canCheckIn(reservation.status) : false,
    canCheckOut: reservation ? canCheckOut(reservation.status) : false,
  };
}
