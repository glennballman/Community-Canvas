import { useQuery } from "@tanstack/react-query";

interface MarinaProperty {
  id: string;
  name: string;
  slip_count: number;
}

interface MarinaPropertiesResponse {
  properties: MarinaProperty[];
}

export function useMarinaProperties() {
  return useQuery({
    queryKey: ["marina-properties"],
    queryFn: async (): Promise<MarinaPropertiesResponse> => {
      const res = await fetch("/api/p2/marina/properties");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error?.message || "Failed to fetch properties");
      return data;
    },
  });
}
