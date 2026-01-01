import { useQuery } from '@tanstack/react-query';

interface JobberJob {
  id: string;
  jobNumber: string;
  title: string;
  instructions: string;
  jobberWebUri: string;
  client: {
    id: string;
    name: string;
    companyName?: string;
    phones?: { number: string }[];
  };
  property?: {
    address: {
      street: string;
      city: string;
      province: string;
      postalCode: string;
    };
  };
  visits?: {
    nodes: {
      id: string;
      title: string;
      startAt: string;
      endAt: string;
      completedAt?: string;
    }[];
  };
}

export function useJobberJob(jobNumber: string | null) {
  return useQuery<JobberJob>({
    queryKey: ['jobber-job', jobNumber],
    queryFn: async () => {
      const response = await fetch(`/api/v1/integrations/jobber/job/${jobNumber}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch job' }));
        throw new Error(error.error || 'Failed to fetch job');
      }
      return response.json();
    },
    enabled: !!jobNumber,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export type { JobberJob };
