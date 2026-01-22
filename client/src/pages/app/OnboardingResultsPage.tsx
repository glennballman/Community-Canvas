/**
 * ONB-03: Onboarding Results Page
 * 
 * Shows promotion summary and created items from onboarding workspace.
 * Route: /app/onboarding/results?workspaceToken=...
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  CheckCircle,
  Image,
  FileText,
  ArrowRight,
  Home,
  AlertCircle
} from 'lucide-react';

interface PromotionSummary {
  mediaCount?: number;
  ingestionCount?: number;
  promotedAt?: string;
}

interface WorkspaceStatus {
  status: 'open' | 'claimed' | 'expired';
  claimed: boolean;
  promoted: boolean;
  next: 'claim' | 'promote' | 'view';
  claimedUserId?: string;
  claimedTenantId?: string;
  promotionSummary?: PromotionSummary;
}

export default function OnboardingResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceToken = searchParams.get('workspaceToken');
  
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceToken) {
      setError('No workspace token provided');
      setLoading(false);
      return;
    }
    loadStatus();
  }, [workspaceToken]);

  const loadStatus = async () => {
    try {
      const res = await fetch(`/api/public/onboard/workspaces/${workspaceToken}/status`);
      const data = await res.json();
      
      if (!data.ok) {
        setError(data.error || 'Workspace not found');
        setLoading(false);
        return;
      }
      
      setStatus(data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load workspace status');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loader-results">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="error-results">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => navigate('/onboard')}>
              Start New Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = status?.promotionSummary || {};

  return (
    <div className="min-h-screen bg-background p-4" data-testid="page-onboarding-results">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl" data-testid="heading-results">
              Workspace Saved!
            </CardTitle>
            <CardDescription>
              Your workspace has been saved to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg bg-muted">
                <Image className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold" data-testid="count-media">
                  {summary.mediaCount || 0}
                </p>
                <p className="text-sm text-muted-foreground">Photos</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-muted">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl font-bold" data-testid="count-ingestion">
                  {summary.ingestionCount || 0}
                </p>
                <p className="text-sm text-muted-foreground">Items</p>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <Button 
                className="w-full gap-2" 
                size="lg"
                onClick={() => navigate('/app')}
                data-testid="button-go-home"
              >
                <Home className="h-5 w-5" />
                Go to Dashboard
              </Button>
              
              <Link to={`/onboard/w/${workspaceToken}/review`}>
                <Button 
                  variant="outline" 
                  className="w-full gap-2"
                  data-testid="button-view-workspace"
                >
                  View Original Workspace
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {status?.promoted && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What's Next?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Badge variant="secondary">1</Badge>
                <div>
                  <p className="font-medium">Review your uploads</p>
                  <p className="text-sm text-muted-foreground">
                    Check that all your photos and notes were captured correctly.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Badge variant="secondary">2</Badge>
                <div>
                  <p className="font-medium">Complete your profile</p>
                  <p className="text-sm text-muted-foreground">
                    Add more details about yourself or your organization.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border">
                <Badge variant="secondary">3</Badge>
                <div>
                  <p className="font-medium">Explore the platform</p>
                  <p className="text-sm text-muted-foreground">
                    Discover tools and features to help you succeed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
