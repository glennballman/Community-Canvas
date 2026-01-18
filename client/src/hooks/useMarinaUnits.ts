import { useQuery } from "@tanstack/react-query";

interface MarinaUnit {
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
  dock_code: string | null;
  dock_side: string | null;
  min_length_ft: number | null;
  max_length_ft: number | null;
  max_beam_ft: number | null;
  max_draft_ft: number | null;
  power_service: string | null;
  has_water: boolean;
  has_pump_out: boolean;
}

interface MarinaUnitsResponse {
  units: MarinaUnit[];
  property: { id: string; name: string } | null;
}

export function useMarinaUnits(propertyId: string | null, dockCode?: string) {
  return useQuery({
    queryKey: ["marina-units", propertyId, dockCode],
    queryFn: async (): Promise<MarinaUnitsResponse> => {
      const params = new URLSearchParams();
      if (propertyId) params.set("propertyId", propertyId);
      if (dockCode && dockCode !== "all") params.set("dockCode", dockCode);

      const res = await fetch(`/api/p2/marina/units?${params}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || "Failed to fetch units");
      return data;
    },
    enabled: !!propertyId,
  });
}
