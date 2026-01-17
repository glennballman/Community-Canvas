import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Send, Check, Clock, AlertCircle, CreditCard,
  Globe, Code, ExternalLink, DollarSign, Shield, Lock, Star, Zap, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  DestinationsResponse, Destination, JobDetailResponse,
  publishJob, PublishResponse, TieringPayload, AttentionTierInfo, AssistanceTierInfo
} from '@/lib/api/jobs';

function formatTierPrice(tier: AttentionTierInfo | AssistanceTierInfo, currency: string): string {
  if (tier.incrementalPriceCents === 0) return '';
  const price = (tier.incrementalPriceCents / 100).toFixed(2);
  const currencySymbol = currency === 'CAD' ? 'CA$' : '$';
  if (tier.unit === 'day') return `+${currencySymbol}${price}/day`;
  if (tier.unit === 'month') return `${currencySymbol}${price}/month`;
  if (tier.unit === 'flat') return `${currencySymbol}${price} flat`;
  return `${currencySymbol}${price}`;
}

function getStateIcon(state: string | null) {
  if (!state) return null;
  switch (state) {
    case 'published':
      return <Check className="h-4 w-4 text-green-500" />;
    case 'pending_review':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'rejected':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'draft':
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    default:
      return null;
  }
}

function getStateBadge(destination: Destination) {
  if (!destination.state) return null;
  
  const state = destination.state.publishState;
  switch (state) {
    case 'published':
      return <Badge className="bg-green-600 text-white">Published</Badge>;
    case 'pending_review':
      return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Pending Review</Badge>;
    case 'rejected':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'draft':
      if (destination.paymentIntent?.status === 'requires_action') {
        return <Badge variant="outline" className="text-orange-600 border-orange-600">Pending Payment</Badge>;
      }
      return <Badge variant="secondary">Draft</Badge>;
    case 'paused':
      return <Badge variant="secondary">Paused</Badge>;
    case 'archived':
      return <Badge variant="secondary">Archived</Badge>;
    default:
      return null;
  }
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency,
  }).format(cents / 100);
}

export default function JobDestinationsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedDestinations, setSelectedDestinations] = useState<Set<string>>(new Set());
  const [checkoutModal, setCheckoutModal] = useState<{ open: boolean; destination?: Destination }>({ open: false });

  const { data: jobData, isLoading: jobLoading } = useQuery<JobDetailResponse>({
    queryKey: ['/api/p2/app/jobs', id],
    enabled: !!id,
  });

  const { data: destinationsData, isLoading: destLoading } = useQuery<DestinationsResponse>({
    queryKey: ['/api/p2/app/jobs', id, 'destinations'],
    enabled: !!id,
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const portalIds = Array.from(selectedDestinations).filter(id => {
        const dest = destinationsData?.destinations.find(d => d.id === id);
        return dest?.destinationType === 'portal';
      });
      const embedIds = Array.from(selectedDestinations).filter(id => {
        const dest = destinationsData?.destinations.find(d => d.id === id);
        return dest?.destinationType === 'embed';
      });
      return publishJob(id!, portalIds, embedIds);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/jobs', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/jobs', id, 'destinations'] });
      
      if (result.paymentRequiredDestinations && result.paymentRequiredDestinations.length > 0) {
        toast({
          title: 'Payment Required',
          description: `${result.paymentRequiredDestinations.length} destination(s) require payment before publishing.`,
        });
        navigate('/app/jobs/payments/pending');
      } else if (result.publishedDestinations.length > 0) {
        const pendingReview = result.publishedDestinations.filter((d: any) => d.publishState === 'pending_review');
        const published = result.publishedDestinations.filter((d: any) => d.publishState === 'published');
        
        if (pendingReview.length > 0) {
          toast({
            title: 'Submitted for Review',
            description: `${pendingReview.length} submission(s) pending moderation approval.`,
          });
        }
        if (published.length > 0) {
          toast({
            title: 'Published',
            description: `Job is now live on ${published.length} destination(s).`,
          });
        }
      }
      setSelectedDestinations(new Set());
    },
    onError: (error: any) => {
      toast({
        title: 'Publish failed',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    }
  });

  const handleToggleDestination = (destId: string, checked: boolean) => {
    setSelectedDestinations(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(destId);
      } else {
        next.delete(destId);
      }
      return next;
    });
  };

  const handlePublish = () => {
    const hasPaid = Array.from(selectedDestinations).some(id => {
      const dest = destinationsData?.destinations.find(d => d.id === id);
      return dest?.pricing.requiresCheckout && dest?.pricing.priceCents;
    });

    if (hasPaid) {
      const paidDest = destinationsData?.destinations.find(d => 
        selectedDestinations.has(d.id) && d.pricing.requiresCheckout
      );
      setCheckoutModal({ open: true, destination: paidDest });
    } else {
      publishMutation.mutate();
    }
  };

  const handleCheckoutConfirm = () => {
    setCheckoutModal({ open: false });
    publishMutation.mutate();
  };

  const job = jobData?.job;
  const destinations = destinationsData?.destinations || [];
  const portals = destinations.filter(d => d.destinationType === 'portal');
  const embeds = destinations.filter(d => d.destinationType === 'embed');

  const isLoading = jobLoading || destLoading;

  const unpublishedPortals = portals.filter(d => !d.state || d.state.publishState !== 'published');
  const canPublish = selectedDestinations.size > 0;

  const totalCost = Array.from(selectedDestinations).reduce((sum, id) => {
    const dest = destinations.find(d => d.id === id);
    if (dest?.pricing.priceCents) {
      return sum + dest.pricing.priceCents;
    }
    return sum;
  }, 0);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-job-destinations">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/jobs')} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{job?.title || 'Job Destinations'}</h1>
          <p className="text-sm text-muted-foreground">
            Choose where to publish this job
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <Button variant="outline" size="sm" onClick={() => navigate(`/app/jobs/${id}/edit`)} data-testid="button-edit-job">
          Edit Job
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Job Portals
              </CardTitle>
              <CardDescription>
                Publish to community job boards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {portals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No portals available</p>
              ) : (
                portals.map(portal => {
                  const isPublished = portal.state?.publishState === 'published';
                  const isPendingPayment = portal.paymentIntent?.status === 'requires_action';
                  const canSelect = !isPublished && !isPendingPayment;

                  return (
                    <div 
                      key={portal.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`destination-${portal.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {canSelect && (
                          <Checkbox
                            checked={selectedDestinations.has(portal.id)}
                            onCheckedChange={(checked) => handleToggleDestination(portal.id, !!checked)}
                            data-testid={`checkbox-${portal.id}`}
                          />
                        )}
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {portal.name}
                            {getStateBadge(portal)}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            {portal.pricing.priceCents ? (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {formatPrice(portal.pricing.priceCents, portal.pricing.currency)}
                                <Badge variant="outline" className="ml-1 text-xs">Paid placement</Badge>
                              </span>
                            ) : (
                              <span className="text-green-600">Free</span>
                            )}
                            {portal.moderation.requiresModeration && (
                              <span className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                Requires review
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {portal.state?.publishedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(portal.state.publishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {(() => {
            const paidPortal = portals.find(p => p.pricing.priceCents && p.pricing.priceCents > 0 && p.tiering);
            if (!paidPortal) return null;
            
            const tiering = paidPortal.tiering;
            const featuredTier = tiering?.attentionTiers.find(t => t.key === 'featured');
            const urgentTier = tiering?.attentionTiers.find(t => t.key === 'urgent');
            const currency = tiering?.currency || 'CAD';
            
            return (
              <Card className="border-dashed opacity-60">
                <CardHeader className="pb-2">
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center justify-between w-full group">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Star className="h-4 w-4" />
                        Boost Visibility
                        <Badge variant="outline" className="ml-2 text-xs">Coming Soon</Badge>
                      </CardTitle>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                      <CardDescription className="mb-4">
                        These upgrades are not available yet.
                      </CardDescription>
                      <div className="space-y-3">
                        {featuredTier && (
                          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                              <Lock className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium text-sm flex items-center gap-2">
                                  <Zap className="h-3 w-3 text-amber-500" />
                                  {featuredTier.label}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {featuredTier.description} ({formatTierPrice(featuredTier, currency)})
                                </div>
                              </div>
                            </div>
                            <Checkbox disabled data-testid="checkbox-tier-featured" />
                          </div>
                        )}
                        {urgentTier && (
                          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                            <div className="flex items-center gap-3">
                              <Lock className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <div className="font-medium text-sm flex items-center gap-2">
                                  <AlertCircle className="h-3 w-3 text-red-500" />
                                  {urgentTier.label}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {urgentTier.description} ({formatTierPrice(urgentTier, currency)})
                                </div>
                              </div>
                            </div>
                            <Checkbox disabled data-testid="checkbox-tier-urgent" />
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardHeader>
              </Card>
            );
          })()}

          {(() => {
            const paidPortal = portals.find(p => p.pricing.priceCents && p.pricing.priceCents > 0 && p.tiering);
            if (!paidPortal) return null;
            
            const tiering = paidPortal.tiering;
            const assistedTier = tiering?.assistanceTiers.find(t => t.key === 'assisted');
            const currency = tiering?.currency || 'CAD';
            
            if (!assistedTier) return null;
            
            return (
              <Card className="border-dashed opacity-60">
                <CardHeader className="pb-2">
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center justify-between w-full group">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4" />
                        Save Time
                        <Badge variant="outline" className="ml-2 text-xs">Coming Soon</Badge>
                      </CardTitle>
                      <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4">
                      <CardDescription className="mb-4">
                        These upgrades are not available yet.
                      </CardDescription>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium text-sm flex items-center gap-2">
                                <Users className="h-3 w-3 text-blue-500" />
                                {assistedTier.label}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {assistedTier.notes || 'Platform screening assistance'} ({formatTierPrice(assistedTier, currency)})
                              </div>
                            </div>
                          </div>
                          <Checkbox disabled data-testid="checkbox-tier-assisted" />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardHeader>
              </Card>
            );
          })()}

          {embeds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  Embed Surfaces
                </CardTitle>
                <CardDescription>
                  Publish to your website widgets
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {embeds.map(embed => {
                  const isPublished = embed.state?.publishState === 'published';
                  
                  return (
                    <div 
                      key={embed.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`destination-${embed.id}`}
                    >
                      <div className="flex items-center gap-3">
                        {!isPublished && (
                          <Checkbox
                            checked={selectedDestinations.has(embed.id)}
                            onCheckedChange={(checked) => handleToggleDestination(embed.id, !!checked)}
                          />
                        )}
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {embed.name}
                            {getStateBadge(embed)}
                          </div>
                          <div className="text-sm text-muted-foreground text-green-600">
                            Free
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Publish Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span>Selected destinations</span>
                  <span className="font-medium">{selectedDestinations.size}</span>
                </div>
                {totalCost > 0 && (
                  <div className="flex justify-between">
                    <span>Total cost</span>
                    <span className="font-medium">{formatPrice(totalCost, 'CAD')}</span>
                  </div>
                )}
              </div>

              <Separator />

              <Button 
                className="w-full" 
                disabled={!canPublish || publishMutation.isPending}
                onClick={handlePublish}
                data-testid="button-publish"
              >
                <Send className="h-4 w-4 mr-2" />
                {publishMutation.isPending ? 'Publishing...' : totalCost > 0 ? 'Proceed to Checkout' : 'Publish'}
              </Button>

              {totalCost > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Paid placements require checkout before publishing
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={checkoutModal.open} onOpenChange={(open) => setCheckoutModal({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Checkout Required
            </DialogTitle>
            <DialogDescription>
              Your selection includes paid placements. A payment intent will be created for you to complete.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              {checkoutModal.destination && (
                <>
                  <div className="flex justify-between">
                    <span>{checkoutModal.destination.name}</span>
                    <span className="font-medium">
                      {formatPrice(checkoutModal.destination.pricing.priceCents || 0, checkoutModal.destination.pricing.currency)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Payment will be processed by staff. Your listing will appear as "Pending Payment" until confirmed.
                  </p>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutModal({ open: false })}>
              Cancel
            </Button>
            <Button onClick={handleCheckoutConfirm} data-testid="button-confirm-checkout">
              Create Payment Intent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
