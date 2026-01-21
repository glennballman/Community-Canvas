/**
 * IngestionReviewPage - Prompt A2
 * 
 * Displays:
 * - Media thumbnails
 * - AI proposal payload viewer
 * - Confidence score badge
 * - Confirm/Edit/Discard buttons
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Check, 
  X, 
  Pencil, 
  Truck, 
  Wrench, 
  StickyNote,
  Loader2,
  ArrowLeft,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface MediaItem {
  url: string;
  mime: string;
  bytes: number;
  captured_at: string;
}

interface Ingestion {
  id: string;
  tenantId: string;
  contractorProfileId: string;
  sourceType: string;
  status: string;
  media: MediaItem[];
  aiProposedPayload: object;
  humanConfirmedPayload: object | null;
  confidenceScore: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function IngestionReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch ingestion
  const { data, isLoading, error } = useQuery<{ ok: boolean; ingestion: Ingestion }>({
    queryKey: ['/api/contractor/ingestions', id],
    enabled: !!id,
  });

  // Confirm mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/contractor/ingestions/${id}/confirm`, {
        human_confirmed_payload: data?.ingestion?.aiProposedPayload || {}
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/ingestions', id] });
      navigate('/app/contractor/onboard');
    },
  });

  // Discard mutation
  const discardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/contractor/ingestions/${id}/discard`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/ingestions', id] });
      navigate('/app/contractor/onboard');
    },
  });

  const ingestion = data?.ingestion;
  const isActionPending = confirmMutation.isPending || discardMutation.isPending;

  // Get source type icon and label
  const getSourceTypeInfo = (sourceType: string) => {
    switch (sourceType) {
      case 'vehicle_photo':
        return { icon: Truck, label: 'Vehicle', color: 'text-blue-600 dark:text-blue-400' };
      case 'tool_photo':
        return { icon: Wrench, label: 'Tools', color: 'text-green-600 dark:text-green-400' };
      case 'sticky_note':
        return { icon: StickyNote, label: 'Sticky Note', color: 'text-amber-600 dark:text-amber-400' };
      default:
        return { icon: AlertCircle, label: 'Unknown', color: 'text-muted-foreground' };
    }
  };

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'proposed':
        return <Badge variant="secondary">Proposed</Badge>;
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Confirmed</Badge>;
      case 'discarded':
        return <Badge variant="outline">Discarded</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Get confidence badge
  const getConfidenceBadge = (score: string | null) => {
    const numScore = score ? parseFloat(score) : 0;
    if (numScore >= 80) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">High Confidence ({numScore}%)</Badge>;
    } else if (numScore >= 50) {
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Medium Confidence ({numScore}%)</Badge>;
    } else {
      return <Badge variant="outline">Low Confidence ({numScore}%)</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !ingestion) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-lg font-semibold mb-2">Ingestion Not Found</h2>
              <p className="text-muted-foreground mb-4">
                This ingestion may have been deleted or you don't have access to it.
              </p>
              <Button onClick={() => navigate('/app/contractor/onboard')}>
                Back to Onboarding
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const sourceInfo = getSourceTypeInfo(ingestion.sourceType);
  const SourceIcon = sourceInfo.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/app/contractor/onboard')}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <SourceIcon className={`h-5 w-5 ${sourceInfo.color}`} />
            <h1 className="text-lg font-semibold" data-testid="text-review-title">
              Review {sourceInfo.label} Capture
            </h1>
          </div>
        </div>
        {getStatusBadge(ingestion.status)}
      </div>

      {/* Main content */}
      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Media thumbnails */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Captured Photos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {(ingestion.media as MediaItem[]).map((item, index) => (
                <div 
                  key={index} 
                  className="aspect-square rounded-md overflow-hidden border"
                >
                  <img 
                    src={item.url} 
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    data-testid={`img-media-${index}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Proposal */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI Proposal
              </CardTitle>
              {getConfidenceBadge(ingestion.confidenceScore)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-md p-3 overflow-auto max-h-64">
              <pre className="text-xs font-mono whitespace-pre-wrap" data-testid="text-ai-proposal">
                {JSON.stringify(ingestion.aiProposedPayload, null, 2)}
              </pre>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              AI recognition will be enabled in a future update. For now, you can confirm and proceed.
            </p>
          </CardContent>
        </Card>

        {/* Action buttons */}
        {ingestion.status === 'proposed' && (
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={() => confirmMutation.mutate()}
              disabled={isActionPending}
              data-testid="button-confirm"
            >
              {confirmMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm
            </Button>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  // Edit stub - real editor in A4/B3/C4
                  console.log('[INGESTION] Edit requested - coming in future prompt');
                }}
                disabled={isActionPending}
                data-testid="button-edit"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              
              <Button
                variant="outline"
                onClick={() => discardMutation.mutate()}
                disabled={isActionPending}
                data-testid="button-discard"
              >
                {discardMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Discard
              </Button>
            </div>
          </div>
        )}

        {/* Already processed message */}
        {ingestion.status !== 'proposed' && (
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-muted-foreground">
                This ingestion has been {ingestion.status}.
              </p>
              <Button 
                variant="outline" 
                className="mt-3"
                onClick={() => navigate('/app/contractor/onboard')}
              >
                Back to Onboarding
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
