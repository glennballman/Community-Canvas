/**
 * ONB-04: Authenticated Onboarding Results Page
 * 
 * The "Holy Cow" moment - shows user what was extracted from their photos.
 * Displays A2.6 Next Actions, A2.7 Photo Bundles, and workspace summary.
 * 
 * Route: /app/onboarding/results?workspaceToken=...
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  CheckCircle,
  Image,
  FileText,
  ArrowRight,
  Home,
  AlertCircle,
  Sparkles,
  Camera,
  Building2,
  Truck,
  ClipboardList,
  MapPin,
  Zap,
  ChevronRight,
  Check,
  X,
  MessageSquare,
  RefreshCw
} from 'lucide-react';

interface NextAction {
  id: string;
  actionType: string;
  title: string;
  payload: Record<string, any>;
  status: 'pending' | 'confirmed' | 'dismissed';
  priority: number;
}

interface PhotoBundle {
  id: string;
  bundleType: string;
  label: string;
  thumbnailUrl?: string;
  photoCount: number;
}

interface WorkspaceResult {
  workspace: {
    id: string;
    guestToken: string;
    status: string;
    intent: string;
    claimedAt?: string;
    promotedAt?: string;
    modeHints?: {
      intent?: string;
      entry?: string;
      portalSlug?: string;
    };
    promotionSummary?: {
      zoneCount?: number;
      workRequestId?: string;
    };
  };
  summary: {
    mediaCount: number;
    ingestionCount: number;
    actionsPending: number;
    actionsCompleted: number;
    zoneCount?: number;
    workRequestId?: string;
  };
  nextActions: NextAction[];
  photoBundles: PhotoBundle[];
  thread?: {
    id: string;
    messageCount: number;
  };
}

const ACTION_TYPE_ICONS: Record<string, typeof Camera> = {
  create_work_request: ClipboardList,
  attach_to_zone: MapPin,
  request_more_photos: Camera,
  draft_n3_run: Truck,
  open_quote_draft: FileText,
  add_tool: Zap,
  add_fleet: Truck,
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_work_request: 'Create Work Request',
  attach_to_zone: 'Add to Property Zone',
  request_more_photos: 'Need More Photos',
  draft_n3_run: 'Plan Service Run',
  open_quote_draft: 'Draft Quote',
  add_tool: 'Add Equipment',
  add_fleet: 'Add to Fleet',
};

export default function OnboardingResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceToken = searchParams.get('workspaceToken');
  
  const [results, setResults] = useState<WorkspaceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionUpdating, setActionUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceToken) {
      setError('No workspace token provided');
      setLoading(false);
      return;
    }
    loadResults();
  }, [workspaceToken]);

  const loadResults = async () => {
    try {
      const token = localStorage.getItem('cc_token');
      if (!token) {
        navigate(`/onboard/w/${workspaceToken}/claim`);
        return;
      }

      const res = await fetch(`/api/onboarding/results?workspaceToken=${workspaceToken}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        navigate(`/onboard/w/${workspaceToken}/claim`);
        return;
      }

      const data = await res.json();
      
      if (!data.ok) {
        setError(data.error || 'Failed to load workspace');
        setLoading(false);
        return;
      }
      
      setResults(data);
      setLoading(false);
    } catch (err) {
      setError('Failed to load workspace results');
      setLoading(false);
    }
  };

  const handleActionUpdate = async (actionId: string, status: 'confirmed' | 'dismissed') => {
    if (!results) return;
    setActionUpdating(actionId);

    try {
      const token = localStorage.getItem('cc_token');
      const res = await fetch(`/api/contractor/ingestion-intelligence/actions/${actionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        setResults({
          ...results,
          nextActions: results.nextActions.map(a => 
            a.id === actionId ? { ...a, status } : a
          ),
          summary: {
            ...results.summary,
            actionsPending: Math.max(0, results.summary.actionsPending - 1),
            actionsCompleted: results.summary.actionsCompleted + (status === 'confirmed' ? 1 : 0)
          }
        });
      }
    } catch (err) {
      console.error('Failed to update action:', err);
    } finally {
      setActionUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loader-results">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your workspace...</p>
        </div>
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
            <Button onClick={() => navigate('/onboard')} data-testid="button-start-new">
              Start New Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!results) return null;

  const { workspace, summary, nextActions, photoBundles } = results;
  const pendingActions = nextActions.filter(a => a.status === 'pending');
  
  // RES-ONB-01: Detect resident mode for different UI copy
  const modeHints = workspace.modeHints || {};
  const isResidentMode = modeHints.intent === 'need' || modeHints.entry === 'place';
  const zoneCount = summary.zoneCount || workspace.promotionSummary?.zoneCount || 0;
  const workRequestId = summary.workRequestId || workspace.promotionSummary?.workRequestId;

  return (
    <div className="min-h-screen bg-background" data-testid="page-onboarding-results">
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-2">
              <div className="p-3 rounded-full bg-primary/10">
                {isResidentMode ? (
                  <Home className="h-10 w-10 text-primary" />
                ) : (
                  <Sparkles className="h-10 w-10 text-primary" />
                )}
              </div>
            </div>
            <CardTitle className="text-2xl" data-testid="heading-results">
              {isResidentMode ? 'Your Request is Ready!' : 'Your Workspace is Ready!'}
            </CardTitle>
            <CardDescription className="text-base">
              {isResidentMode 
                ? 'We\'ve captured your property details and created a work request.'
                : 'We analyzed your photos and found some interesting things.'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-3 py-4 ${isResidentMode ? 'grid-cols-3' : 'grid-cols-4'}`}>
              <div className="text-center p-3 rounded-lg bg-background">
                <Camera className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold" data-testid="count-media">
                  {summary.mediaCount}
                </p>
                <p className="text-xs text-muted-foreground">Photos</p>
              </div>
              {isResidentMode ? (
                <>
                  <div className="text-center p-3 rounded-lg bg-background">
                    <MapPin className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xl font-bold" data-testid="count-zones">
                      {zoneCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Zones</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background">
                    {workRequestId ? (
                      <>
                        <CheckCircle className="h-6 w-6 mx-auto mb-1 text-green-500" />
                        <p className="text-xl font-bold" data-testid="count-request">1</p>
                        <p className="text-xs text-muted-foreground">Request</p>
                      </>
                    ) : (
                      <>
                        <ClipboardList className="h-6 w-6 mx-auto mb-1 text-amber-500" />
                        <p className="text-xl font-bold">Draft</p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center p-3 rounded-lg bg-background">
                    <FileText className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xl font-bold" data-testid="count-ingestion">
                      {summary.ingestionCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Items</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background">
                    <Zap className="h-6 w-6 mx-auto mb-1 text-amber-500" />
                    <p className="text-xl font-bold" data-testid="count-actions-pending">
                      {summary.actionsPending}
                    </p>
                    <p className="text-xs text-muted-foreground">Actions</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-background">
                    <CheckCircle className="h-6 w-6 mx-auto mb-1 text-green-500" />
                    <p className="text-xl font-bold" data-testid="count-actions-completed">
                      {summary.actionsCompleted}
                    </p>
                    <p className="text-xs text-muted-foreground">Done</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RES-ONB-01: Hide contractor-centric actions for resident mode */}
        {pendingActions.length > 0 && !isResidentMode && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Suggested Actions</CardTitle>
              <Badge variant="secondary" className="ml-auto">
                {pendingActions.length} pending
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingActions.slice(0, 5).map((action) => {
                const Icon = ACTION_TYPE_ICONS[action.actionType] || Zap;
                const label = ACTION_TYPE_LABELS[action.actionType] || action.actionType;
                
                return (
                  <div 
                    key={action.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover-elevate"
                    data-testid={`action-${action.id}`}
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{action.title}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={actionUpdating === action.id}
                        onClick={() => handleActionUpdate(action.id, 'confirmed')}
                        data-testid={`button-confirm-${action.id}`}
                      >
                        {actionUpdating === action.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={actionUpdating === action.id}
                        onClick={() => handleActionUpdate(action.id, 'dismissed')}
                        data-testid={`button-dismiss-${action.id}`}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              {pendingActions.length > 5 && (
                <Button variant="ghost" className="w-full gap-2" data-testid="button-view-all-actions">
                  View all {pendingActions.length} actions
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {photoBundles.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Camera className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Photo Collections</CardTitle>
              <Badge variant="secondary" className="ml-auto">
                {photoBundles.length} bundles
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {photoBundles.map((bundle) => (
                  <div 
                    key={bundle.id}
                    className="relative rounded-lg border overflow-hidden hover-elevate cursor-pointer"
                    data-testid={`bundle-${bundle.id}`}
                  >
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      {bundle.thumbnailUrl ? (
                        <img 
                          src={bundle.thumbnailUrl} 
                          alt={bundle.label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="p-2">
                      <p className="font-medium text-sm truncate">{bundle.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {bundle.photoCount} photo{bundle.photoCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className="absolute top-2 right-2 text-xs"
                    >
                      {bundle.bundleType}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What's Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isResidentMode ? (
              <>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge variant="secondary">1</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Review your work request</p>
                    <p className="text-sm text-muted-foreground">
                      Check that your property zones and photos are correct.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge variant="secondary">2</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Get matched with contractors</p>
                    <p className="text-sm text-muted-foreground">
                      We'll find qualified contractors in your area.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge variant="secondary">3</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Receive quotes</p>
                    <p className="text-sm text-muted-foreground">
                      Compare quotes and choose the best fit for your project.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge variant="secondary">1</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Review suggested actions</p>
                    <p className="text-sm text-muted-foreground">
                      Confirm or dismiss the actions we identified from your photos.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge variant="secondary">2</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Complete your profile</p>
                    <p className="text-sm text-muted-foreground">
                      Add your business details and service areas.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Badge variant="secondary">3</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Explore the platform</p>
                    <p className="text-sm text-muted-foreground">
                      Discover tools to help you manage your work.
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          {isResidentMode && workRequestId ? (
            <Button 
              className="flex-1 gap-2" 
              size="lg"
              onClick={() => navigate('/app/work-requests')}
              data-testid="button-view-request"
            >
              <ClipboardList className="h-5 w-5" />
              View Your Request
            </Button>
          ) : (
            <Button 
              className="flex-1 gap-2" 
              size="lg"
              onClick={() => navigate('/app')}
              data-testid="button-go-dashboard"
            >
              <Home className="h-5 w-5" />
              Go to Dashboard
            </Button>
          )}
          
          <Button 
            variant="outline" 
            className="flex-1 gap-2"
            onClick={loadResults}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Workspace token: {workspaceToken?.substring(0, 8)}...
        </p>
      </div>
    </div>
  );
}
