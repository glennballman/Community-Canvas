/**
 * RES-ONB-01: Onboard Place Entry
 * 
 * Resident-biased entry point that creates workspace with intent='need'.
 * Routes: /onboard/place, /onboard/place/:portalSlug
 * 
 * Immediately creates workspace and redirects - no prompt.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Home } from 'lucide-react';

export default function OnboardPlacePage() {
  const { portalSlug } = useParams<{ portalSlug?: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createWorkspace();
  }, []);

  const createWorkspace = async () => {
    try {
      const res = await fetch('/api/public/onboard/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          intent: 'need',
          entry: 'place',
          portalSlug: portalSlug || undefined
        })
      });
      const data = await res.json();
      
      if (data.ok && data.token) {
        navigate(`/onboard/w/${data.token}`);
      } else {
        setError(data.error || 'Failed to start');
      }
    } catch (err) {
      setError('Failed to connect');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="page-onboard-place">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Home className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="page-onboard-place">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Home className="h-12 w-12 mx-auto text-primary mb-2" />
          <CardTitle data-testid="heading-place">Set up your place</CardTitle>
          <CardDescription>
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
            Getting things ready...
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
