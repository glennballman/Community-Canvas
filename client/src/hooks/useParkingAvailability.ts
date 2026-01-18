import { useQuery } from "@tanstack/react-query";

interface ParkingAllocation {
  unit_id: string;
  unit_code: string;
  status: "available" | "occupied" | "reserved" | "maintenance";
  allocation_id: string | null;
  guest_name: string | null;
  vehicle_plate: string | null;
  starts_at: string | null;
  ends_at: string | null;
  reservation_id: string | null;
}

interface ParkingAvailabilityResponse {
  date: string;
  allocations: ParkingAllocation[];
}

export function useParkingAvailability(propertyId: string | null, date: Date) {
  const dateStr = date.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["parking-availability", propertyId, dateStr],
    queryFn: async (): Promise<ParkingAvailabilityResponse> => {
      const params = new URLSearchParams();
      if (propertyId) params.set("propertyId", propertyId);
      params.set("date", dateStr);

      const res = await fetch(`/api/p2/parking/availability?${params}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || "Failed to fetch availability");
      return data;
    },
    enabled: !!propertyId,
    refetchInterval: 60000,
  });
}
