import { useQuery } from "@tanstack/react-query";

interface ParkingUnit {
  id: string;
  code: string;
  name: string;
  unit_type: string;
  status: string;
  layout_x: number | null;
  layout_y: number | null;
  layout_rotation: number | null;
  layout_shape: object | null;
  layout_ref: string | null;
  zone_code: string | null;
  size_class: string | null;
  covered: boolean;
  accessible: boolean;
  ev_charging: boolean;
}

interface ParkingUnitsResponse {
  units: ParkingUnit[];
  property: { id: string; name: string } | null;
}

export function useParkingUnits(propertyId: string | null, zoneCode?: string) {
  return useQuery({
    queryKey: ["parking-units", propertyId, zoneCode],
    queryFn: async (): Promise<ParkingUnitsResponse> => {
      const params = new URLSearchParams();
      if (propertyId) params.set("propertyId", propertyId);
      if (zoneCode && zoneCode !== "all") params.set("zoneCode", zoneCode);

      const res = await fetch(`/api/p2/parking/units?${params}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || "Failed to fetch units");
      return data;
    },
    enabled: !!propertyId,
  });
}
