import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface TrailerQualification {
  trailerId: string;
  trailerName: string;
  trailerType: string;
  isQualified: boolean;
  issueCount: number;
  warningCount: number;
  primaryIssue: string | null;
}

interface DriverQualificationSummary {
  driver: {
    id: string;
    name: string;
    licenseClass: string | null;
    licenseProvince: string | null;
    licenseExpiry: string | null;
    endorsements: {
      airBrake: boolean;
      houseTrailer: boolean;
      heavyTrailer: boolean;
    };
    medicalExpiry: string | null;
    experience: {
      fifthWheel: boolean;
      gooseneck: boolean;
      horseTrailer: boolean;
      boatLaunching: boolean;
    };
  };
  summary: {
    qualifiedFor: number;
    totalTrailers: number;
    percentageQualified: number;
  };
  trailerQualifications: TrailerQualification[];
}

interface QualificationCheckResult {
  qualification: {
    isQualified: boolean;
    issues: string[];
    warnings: string[];
    requiredEndorsements: string[];
  };
  driver: {
    id: string;
    name: string;
    licenseClass: string | null;
  };
  trailer: {
    id: string;
    name: string;
    type: string;
    gvwrKg: number;
  };
}

export function useDriverQualifications(driverId: string | null) {
  return useQuery<DriverQualificationSummary>({
    queryKey: ['/api/v1/fleet/driver-qualification-summary', driverId],
    queryFn: async () => {
      if (!driverId) throw new Error('No driver ID');
      const response = await fetch(`/api/v1/fleet/driver-qualification-summary/${driverId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch driver qualifications');
      }
      return response.json();
    },
    enabled: !!driverId,
    staleTime: 30000,
  });
}

export function useQualificationCheck(driverId: string | null, trailerId: string | null) {
  return useQuery<QualificationCheckResult>({
    queryKey: ['/api/v1/fleet/check-driver-qualification', driverId, trailerId],
    queryFn: async () => {
      if (!driverId || !trailerId) throw new Error('Missing IDs');
      const response = await apiRequest('POST', '/api/v1/fleet/check-driver-qualification', {
        driverId,
        trailerId,
        province: 'BC'
      });
      return response.json();
    },
    enabled: !!driverId && !!trailerId,
    staleTime: 30000,
  });
}
