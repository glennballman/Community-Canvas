import { useQuery } from "@tanstack/react-query";

interface ParkingProperty {
  id: string;
  name: string;
}

interface ParkingPropertiesResponse {
  properties: ParkingProperty[];
}

export function useParkingProperties() {
  return useQuery({
    queryKey: ["parking-properties"],
    queryFn: async (): Promise<ParkingPropertiesResponse> => {
      const res = await fetch("/api/p2/parking/properties");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || "Failed to fetch properties");
      return data;
    },
  });
}
