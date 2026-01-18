import { useQuery } from "@tanstack/react-query";

interface MarinaAllocation {
  unit_id: string;
  unit_code: string;
  status: "available" | "occupied" | "reserved" | "maintenance";
  allocation_id: string | null;
  guest_name: string | null;
  vessel_name: string | null;
  vessel_length_ft: number | null;
  starts_at: string | null;
  ends_at: string | null;
  reservation_id: string | null;
}

interface MarinaAvailabilityResponse {
  date: string;
  allocations: MarinaAllocation[];
}

export function useMarinaAvailability(propertyId: string | null, date: Date) {
  const dateStr = date.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["marina-availability", propertyId, dateStr],
    queryFn: async (): Promise<MarinaAvailabilityResponse> => {
      const params = new URLSearchParams();
      if (propertyId) params.set("propertyId", propertyId);
      params.set("date", dateStr);

      const res = await fetch(`/api/p2/marina/availability?${params}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || "Failed to fetch availability");
      return data;
    },
    enabled: !!propertyId,
    refetchInterval: 60000,
  });
}
