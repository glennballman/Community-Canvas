/**
 * Service Areas Onboarding Page - Prompt A2.2
 * 
 * The "5th WOW" moment where contractors realize:
 * "Holy sh*t — it already knows where I work."
 * 
 * Appears automatically when:
 * - Identity is confirmed OR
 * - A sticky-note-generated service run exists OR
 * - Job photos include GPS/place names
 */

import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MapPin, 
  Loader2, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { ServiceAreaProposalCard } from '@/components/contractor/ServiceAreaProposalCard';
import { apiRequest } from '@/lib/queryClient';

interface ServiceAreaProposal {
  id: string;
  coverage_type: 'zone' | 'portal' | 'radius' | 'route';
  portal_id?: string;
  portal_name?: string;
  zone_id?: string;
  zone_label?: string;
  coverage_payload: {
    lat?: number;
    lng?: number;
    radius_km?: number;
    from?: string;
    to?: string;
    buffer_km?: number;
    zone_label?: string;
    portal_name?: string;
  };
  confidence: number;
  source: string;
  evidence?: string[];
}

export default function ServiceAreasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  
  const { 
    data: proposalsData, 
    isLoading,
    refetch
  } = useQuery<{ success: boolean; proposals: ServiceAreaProposal[]; message: string }>({
    queryKey: ['/api/contractor/profile/service-areas/propose'],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/contractor/profile/service-areas/propose', {});
      return res.json();
    },
    enabled: !!user && !!currentTenant,
  });
  
  const dismissMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/contractor/profile/service-areas/dismiss', {});
      return res.json();
    },
    onSuccess: () => {
      navigate('/app/contractor/jobs');
    }
  });
  
  const handleComplete = () => {
    navigate('/app/contractor/jobs');
  };
  
  const handleSkip = () => {
    dismissMutation.mutate();
  };
  
  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              <Skeleton className="h-8 w-48" />
            </div>
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const proposals = proposalsData?.proposals || [];
  
  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
            Powered by your uploads
          </span>
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="h-7 w-7 text-primary" />
          Where do you usually take work?
        </h1>
        <p className="text-muted-foreground mt-2">
          Based on what you've uploaded, here's where it looks like you usually work.
          This helps us surface nearby work requests, but nothing is shared unless you say yes.
        </p>
      </div>
      
      {proposals.length > 0 ? (
        <ServiceAreaProposalCard
          proposals={proposals}
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              No Service Areas Detected Yet
            </CardTitle>
            <CardDescription>
              We couldn't find any location signals from your uploads.
              This is totally fine — you can set this up later or skip it entirely.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">How to help us find your service areas:</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Upload photos from job sites (GPS is extracted automatically)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Add sticky notes with place names or addresses
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Complete your identity setup with company location
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="mt-6 flex justify-between items-center">
        <Button 
          variant="ghost" 
          onClick={handleSkip}
          disabled={dismissMutation.isPending}
          data-testid="button-skip-to-jobs"
        >
          {dismissMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          I just want to view my jobs right now
        </Button>
        
        <Button 
          variant="outline"
          onClick={() => navigate('/app/contractor/onboard')}
          data-testid="button-back-to-onboard"
        >
          Upload more
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
