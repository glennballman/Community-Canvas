/**
 * A2.7: Photo Bundle Detail Page
 * 
 * Full detail view for a proof bundle including:
 * - Timeline visualization
 * - Quality scores
 * - Proof claims and missing items
 * - Actions: recompute, add photos, confirm bundle
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft,
  Camera,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Clock,
  MapPin,
  Star,
  FileCheck,
  Lock,
  ChevronRight,
  Plus
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useTenant } from '@/contexts/TenantContext';

interface TimelineItem {
  mediaId: string;
  stage: 'before' | 'during' | 'after';
  timestamp: string | null;
  orderIndex: number;
  qualityScore: number;
  qualityFactors: {
    hasTimestamp: boolean;
    hasGeo: boolean;
    resolution: 'low' | 'medium' | 'high';
    fileSize: 'small' | 'medium' | 'large';
  };
}

interface ProofClaim {
  type: string;
  label: string;
  evidence: string[];
}

interface MissingItem {
  stage: string;
  prompt: string;
  priority: 'required' | 'recommended';
}

interface PhotoBundle {
  id: string;
  bundleType: string;
  status: string;
  beforeMediaIds: string[];
  afterMediaIds: string[];
  duringMediaIds: string[];
  timelineJson: {
    items: TimelineItem[];
    ordering: 'chronological' | 'unknown';
    computedAt: string;
  } | null;
  proofJson: {
    claims: ProofClaim[];
    missingItems: MissingItem[];
    riskFlags: string[];
    exportReady: boolean;
    computedAt: string;
  } | null;
  coversFrom: string | null;
  coversTo: string | null;
  centroid: { lat: number; lng: number } | null;
  createdAt: string;
  updatedAt: string;
}

export default function PhotoBundleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  
  const { data, isLoading, refetch } = useQuery<{ ok: boolean; bundle: PhotoBundle }>({
    queryKey: ['/api/contractor/photo-bundles', id],
    queryFn: async () => {
      const res = await fetch(`/api/contractor/photo-bundles/${id}`, {
        headers: {
          'x-portal-id': currentTenant?.tenant_id || '',
          'x-tenant-id': currentTenant?.tenant_id || ''
        },
        credentials: 'include'
      });
      return res.json();
    },
    enabled: !!id && !!currentTenant
  });
  
  const bundle = data?.bundle;
  
  const recomputeMutation = useMutation({
    mutationFn: async () => {
      setIsRecomputing(true);
      const res = await apiRequest('POST', `/api/contractor/photo-bundles/${id}/recompute`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/photo-bundles', id] });
      setIsRecomputing(false);
    },
    onError: () => {
      setIsRecomputing(false);
    }
  });
  
  const confirmMutation = useMutation({
    mutationFn: async () => {
      setIsConfirming(true);
      const res = await apiRequest('POST', `/api/contractor/photo-bundles/${id}/confirm`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/photo-bundles', id] });
      setIsConfirming(false);
    },
    onError: () => {
      setIsConfirming(false);
    }
  });
  
  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!bundle) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Bundle not found</p>
            <Button className="mt-4" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const timeline = bundle.timelineJson?.items || [];
  const proofJson = bundle.proofJson || { claims: [], missingItems: [], riskFlags: [], exportReady: false };
  const claims = proofJson.claims || [];
  const missingItems = proofJson.missingItems || [];
  const riskFlags = proofJson.riskFlags || [];
  
  const beforeCount = bundle.beforeMediaIds?.length || 0;
  const afterCount = bundle.afterMediaIds?.length || 0;
  const duringCount = bundle.duringMediaIds?.length || 0;
  const totalPhotos = beforeCount + afterCount + duringCount;
  
  const averageQuality = timeline.length > 0 
    ? Math.round(timeline.reduce((sum, item) => sum + item.qualityScore, 0) / timeline.length)
    : 0;
  
  const statusColor = bundle.status === 'complete' ? 'bg-green-500/10 text-green-600 border-green-500/20' 
    : bundle.status === 'sealed' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
    : 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  
  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => recomputeMutation.mutate()}
              disabled={isRecomputing}
              data-testid="button-recompute"
            >
              {isRecomputing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Recompute
            </Button>
            
            {bundle.status === 'complete' && (
              <Button 
                size="sm" 
                onClick={() => confirmMutation.mutate()}
                disabled={isConfirming}
                data-testid="button-confirm-bundle"
              >
                {isConfirming ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Seal Bundle
              </Button>
            )}
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10 text-primary">
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle>
                    {bundle.bundleType === 'before_after' ? 'Before/After Bundle' : 'Progress Series'}
                  </CardTitle>
                  <CardDescription>
                    Created {new Date(bundle.createdAt).toLocaleDateString()}
                  </CardDescription>
                </div>
              </div>
              <Badge className={statusColor}>
                {bundle.status === 'sealed' && <Lock className="h-3 w-3 mr-1" />}
                {bundle.status}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{totalPhotos}</div>
                <div className="text-xs text-muted-foreground">Total Photos</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{averageQuality}%</div>
                <div className="text-xs text-muted-foreground">Avg Quality</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{claims.length}</div>
                <div className="text-xs text-muted-foreground">Claims</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{missingItems.length}</div>
                <div className="text-xs text-muted-foreground">Missing</div>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Photo Counts
              </h3>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500" />
                  <span>Before: {beforeCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-amber-500" />
                  <span>During: {duringCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-green-500" />
                  <span>After: {afterCount}</span>
                </div>
              </div>
            </div>
            
            {timeline.length > 0 && (
              <>
                <Separator />
                
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Timeline
                    <Badge variant="secondary" className="text-xs">
                      {bundle.timelineJson?.ordering || 'unknown'}
                    </Badge>
                  </h3>
                  
                  <div className="space-y-2">
                    {timeline.map((item, index) => {
                      const stageColor = item.stage === 'before' ? 'bg-blue-500' 
                        : item.stage === 'after' ? 'bg-green-500' 
                        : 'bg-amber-500';
                      
                      return (
                        <div 
                          key={item.mediaId} 
                          className="flex items-center gap-3 p-2 rounded-lg bg-muted/30"
                          data-testid={`timeline-item-${index}`}
                        >
                          <div className={`w-3 h-3 rounded-full ${stageColor} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium capitalize">{item.stage}</span>
                              {item.timestamp && (
                                <span className="text-muted-foreground">
                                  {new Date(item.timestamp).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Progress value={item.qualityScore} className="h-1.5 w-20" />
                              <span className="text-xs text-muted-foreground">{item.qualityScore}%</span>
                              {item.qualityFactors.hasGeo && (
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                              )}
                              {item.qualityFactors.hasTimestamp && (
                                <Clock className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            
            {claims.length > 0 && (
              <>
                <Separator />
                
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileCheck className="h-4 w-4" />
                    Proof Claims
                  </h3>
                  
                  <div className="space-y-2">
                    {claims.map((claim, index) => (
                      <div 
                        key={index} 
                        className="flex items-start gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20"
                        data-testid={`claim-${index}`}
                      >
                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium text-sm">{claim.label}</div>
                          {claim.evidence.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Evidence: {claim.evidence.length} item{claim.evidence.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            
            {missingItems.length > 0 && (
              <>
                <Separator />
                
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                    Missing Items
                  </h3>
                  
                  <div className="space-y-2">
                    {missingItems.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20"
                        data-testid={`missing-${index}`}
                      >
                        <Plus className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{item.prompt}</span>
                            <Badge 
                              variant={item.priority === 'required' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {item.priority}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Stage: {item.stage}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            
            {riskFlags.length > 0 && (
              <>
                <Separator />
                
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Risk Flags
                  </h3>
                  
                  <div className="flex flex-wrap gap-2">
                    {riskFlags.map((flag, index) => (
                      <Badge key={index} variant="destructive">
                        {flag.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
            
            {bundle.coversFrom && bundle.coversTo && (
              <>
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Time Coverage
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    {new Date(bundle.coversFrom).toLocaleString()} — {new Date(bundle.coversTo).toLocaleString()}
                  </div>
                </div>
              </>
            )}
            
            {bundle.centroid && (
              <>
                <Separator />
                
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    {bundle.centroid.lat.toFixed(5)}, {bundle.centroid.lng.toFixed(5)}
                  </div>
                </div>
              </>
            )}
          </CardContent>
          
          <CardFooter className="justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {proofJson.exportReady ? (
                <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                  <Check className="h-3 w-3 mr-1" />
                  Export Ready
                </Badge>
              ) : (
                <Badge variant="secondary">
                  Not Export Ready
                </Badge>
              )}
            </div>
            
            {bundle.status !== 'sealed' && (
              <Button variant="outline" size="sm" data-testid="button-add-photos">
                <Plus className="h-4 w-4 mr-2" />
                Add Photos
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
