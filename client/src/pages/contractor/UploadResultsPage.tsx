/**
 * A2.3: Upload Results Page - "Here's what I found" UI
 * 
 * Displays:
 * - Classification results for each uploaded image
 * - Extracted entities (license plates, phones, addresses, materials)
 * - Proposed links (fleet, tools, jobsites, customers)
 * - Next actions with accept/edit/dismiss workflow
 * - Opportunities (asset upsells, zone expansion)
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Check, 
  X, 
  Pencil, 
  Truck, 
  Wrench, 
  StickyNote,
  MapPin,
  User,
  Phone,
  Globe,
  Package,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Loader2,
  Camera,
  ChevronRight,
  AlertTriangle,
  Image
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';

interface ClassificationResult {
  primary: string;
  secondary: string[];
  confidence: number;
}

interface ExtractedEntity {
  value: string;
  confidence: number;
}

interface ExtractedEntities {
  // PRIVACY: No licensePlate - only region is stored
  licensePlateRegion?: ExtractedEntity;
  companyName?: ExtractedEntity;
  phone?: ExtractedEntity;
  email?: ExtractedEntity;
  website?: ExtractedEntity;
  customerName?: ExtractedEntity;
  // PRIVACY: Address is ADVISORY ONLY - UI must display as "Photo captured near..."
  addressAdvisory?: ExtractedEntity;
  materials?: Array<{ name: string; qty?: string; unit?: string; confidence: number }>;
}

interface GeoInference {
  lat?: number;
  lng?: number;
  proposedAddress?: string;
  confidence: number;
  source: string;
}

interface ProposedLinks {
  vehicle: boolean;
  trailer: boolean;
  tool: boolean;
  material: boolean;
  jobsite: boolean;
  customer: boolean;
  serviceRun: boolean;
  beforeAfterBundle: boolean;
}

interface NextAction {
  type: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  payload?: any;
}

interface ClassifiedIngestion {
  ingestionId: string;
  classification: ClassificationResult;
  extractedEntities: ExtractedEntities;
  geoInference: GeoInference;
  proposedLinks: ProposedLinks;
  nextActions: NextAction[];
}

interface Opportunity {
  id: string;
  opportunityType: string;
  reason: string;
  confidence: string;
  details: Record<string, any>;
  status: string;
}

function getClassificationIcon(type: string) {
  switch (type) {
    case 'vehicle_truck':
    case 'vehicle_van':
      return <Truck className="h-5 w-5" />;
    case 'vehicle_trailer':
      return <Package className="h-5 w-5" />;
    case 'tool':
    case 'material':
      return <Wrench className="h-5 w-5" />;
    case 'sticky_note':
    case 'whiteboard':
      return <StickyNote className="h-5 w-5" />;
    case 'jobsite':
    case 'before_photo':
    case 'after_photo':
      return <MapPin className="h-5 w-5" />;
    case 'receipt':
    case 'document':
      return <Package className="h-5 w-5" />;
    default:
      return <Image className="h-5 w-5" />;
  }
}

function getClassificationLabel(type: string): string {
  const labels: Record<string, string> = {
    vehicle_truck: 'Truck',
    vehicle_van: 'Van',
    vehicle_trailer: 'Trailer',
    tool: 'Tool',
    material: 'Material',
    sticky_note: 'Sticky Note',
    whiteboard: 'Whiteboard',
    jobsite: 'Jobsite',
    before_photo: 'Before Photo',
    after_photo: 'After Photo',
    receipt: 'Receipt',
    document: 'Document',
    unknown: 'Unknown'
  };
  return labels[type] || type;
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  return (
    <div className="flex items-center gap-2">
      <Progress value={percent} className="h-2 w-16" />
      <span className="text-xs text-muted-foreground">{percent}%</span>
    </div>
  );
}

function ActionCard({ 
  action, 
  ingestionId,
  extractedEntities,
  geoInference
}: { 
  action: NextAction; 
  ingestionId: string;
  extractedEntities: ExtractedEntities;
  geoInference: GeoInference;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const { currentPortal } = useTenant();
  
  const handleAction = async () => {
    if (action.type === 'open_message_thread' && action.payload?.autoCreateThread) {
      setIsLoading(true);
      try {
        await apiRequest(`/api/contractor/ingestions/${ingestionId}/create-thread`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-portal-id': currentPortal?.id || ''
          },
          body: JSON.stringify({
            proposedMessage: action.payload.proposedMessage
          })
        });
        setIsDone(true);
      } catch (err) {
        console.error('Failed to create thread:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  if (isDone) {
    return (
      <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-green-500/10 text-green-600">
        <Check className="h-4 w-4" />
        <span>Proposal saved - create work request to enable messaging</span>
      </div>
    );
  }
  
  return (
    <div 
      className="flex items-center justify-between gap-2 text-sm p-2 rounded-md bg-muted/50 hover-elevate cursor-pointer"
      onClick={handleAction}
      data-testid={`action-${action.type}`}
    >
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-primary mt-0.5" />
        <div>
          <div className="font-medium">{action.title}</div>
          <div className="text-muted-foreground text-xs">{action.description}</div>
        </div>
      </div>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );
}

function ClassificationCard({ 
  result, 
  onAccept, 
  onDismiss 
}: { 
  result: ClassifiedIngestion; 
  onAccept: () => void; 
  onDismiss: () => void;
}) {
  const { classification, extractedEntities, geoInference, proposedLinks, nextActions } = result;
  
  return (
    <Card className="overflow-visible" data-testid={`card-classification-${result.ingestionId}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              {getClassificationIcon(classification.primary)}
            </div>
            <div>
              <CardTitle className="text-lg">{getClassificationLabel(classification.primary)}</CardTitle>
              {classification.secondary.length > 0 && (
                <CardDescription>
                  Also: {classification.secondary.map(getClassificationLabel).join(', ')}
                </CardDescription>
              )}
            </div>
          </div>
          <ConfidenceMeter confidence={classification.confidence} />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {Object.keys(extractedEntities).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Detected Information</h4>
            <div className="grid gap-2">
              {extractedEntities.licensePlateRegion && (
                <div className="flex items-center gap-2 text-sm">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>Vehicle plate detected</span>
                  <Badge variant="secondary">{extractedEntities.licensePlateRegion.value}</Badge>
                </div>
              )}
              {extractedEntities.companyName && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>{extractedEntities.companyName.value}</span>
                </div>
              )}
              {extractedEntities.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{extractedEntities.phone.value}</span>
                </div>
              )}
              {extractedEntities.customerName && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{extractedEntities.customerName.value}</span>
                </div>
              )}
              {extractedEntities.materials && extractedEntities.materials.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    {extractedEntities.materials.map((m, i) => (
                      <div key={i}>{m.name} {m.qty && `(${m.qty} ${m.unit || ''})`}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {geoInference.proposedAddress && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Location (Advisory)</h4>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="italic text-muted-foreground">Photo captured near: {geoInference.proposedAddress}</span>
              <ConfidenceMeter confidence={geoInference.confidence} />
            </div>
          </div>
        )}
        
        {Object.values(proposedLinks).some(Boolean) && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Will Create</h4>
            <div className="flex flex-wrap gap-1">
              {proposedLinks.vehicle && <Badge variant="outline">Fleet Asset</Badge>}
              {proposedLinks.trailer && <Badge variant="outline">Trailer</Badge>}
              {proposedLinks.tool && <Badge variant="outline">Tool</Badge>}
              {proposedLinks.material && <Badge variant="outline">Material</Badge>}
              {proposedLinks.jobsite && <Badge variant="outline">Jobsite</Badge>}
              {proposedLinks.customer && <Badge variant="outline">Customer</Badge>}
              {proposedLinks.beforeAfterBundle && <Badge variant="outline">Before/After Bundle</Badge>}
            </div>
          </div>
        )}
        
        {nextActions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Suggested Actions</h4>
            {nextActions.slice(0, 2).map((action, i) => (
              <ActionCard 
                key={i} 
                action={action} 
                ingestionId={result.ingestionId}
                extractedEntities={extractedEntities}
                geoInference={geoInference}
              />
            ))}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="justify-end gap-2 pt-0">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onDismiss}
          data-testid="button-dismiss"
        >
          <X className="h-4 w-4 mr-1" />
          Dismiss
        </Button>
        <Button 
          size="sm" 
          onClick={onAccept}
          data-testid="button-accept"
        >
          <Check className="h-4 w-4 mr-1" />
          Accept
        </Button>
      </CardFooter>
    </Card>
  );
}

function OpportunityCard({ 
  opportunity, 
  onAccept, 
  onDismiss 
}: { 
  opportunity: Opportunity; 
  onAccept: () => void; 
  onDismiss: () => void;
}) {
  const details = opportunity.details || {};
  
  return (
    <Card className="border-primary/20 bg-primary/5" data-testid={`card-opportunity-${opportunity.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-md bg-primary/20 text-primary">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Growth Opportunity</CardTitle>
            <CardDescription>{opportunity.opportunityType.replace(/_/g, ' ')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <p className="text-sm">{opportunity.reason}</p>
        
        {details.openRequestsCount && (
          <div className="text-sm text-muted-foreground">
            {details.openRequestsCount} open work requests in this area
          </div>
        )}
        
        {details.suggestedAsset && (
          <Badge variant="secondary">
            Suggested: {details.suggestedAsset.replace(/_/g, ' ')}
          </Badge>
        )}
        
        {details.demandLevel && (
          <Badge variant={details.demandLevel === 'high' ? 'default' : 'secondary'}>
            {details.demandLevel.toUpperCase()} demand
          </Badge>
        )}
      </CardContent>
      
      <CardFooter className="justify-end gap-2 pt-0">
        <Button variant="ghost" size="sm" onClick={onDismiss} data-testid="button-opportunity-dismiss">
          Not Now
        </Button>
        <Button size="sm" onClick={onAccept} data-testid="button-opportunity-accept">
          Learn More
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function UploadResultsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  
  // Get ingestion IDs from URL params
  const ingestionIds = searchParams.get('ids')?.split(',') || [];
  
  // Fetch classifications for these ingestions
  const { data: classificationsData, isLoading } = useQuery<{
    ok: boolean;
    classifications: ClassifiedIngestion[];
  }>({
    queryKey: ['/api/contractor/ingestions', 'batch', ingestionIds.join(',')],
    queryFn: async () => {
      // Fetch each ingestion
      const results = await Promise.all(
        ingestionIds.map(async (id) => {
          const res = await fetch(`/api/contractor/ingestions/${id}`, {
            headers: {
              'x-portal-id': currentTenant?.tenant_id || '',
              'x-tenant-id': currentTenant?.tenant_id || ''
            },
            credentials: 'include'
          });
          const data = await res.json();
          if (!data.ok) return null;
          
          const ing = data.ingestion;
          return {
            ingestionId: ing.id,
            classification: ing.classification || { primary: ing.sourceType, secondary: [], confidence: 0.5 },
            extractedEntities: ing.extractedEntities || {},
            geoInference: ing.geoInference || { confidence: 0, source: 'none' },
            proposedLinks: ing.proposedLinks || {},
            nextActions: []
          };
        })
      );
      
      return {
        ok: true,
        classifications: results.filter(Boolean) as ClassifiedIngestion[]
      };
    },
    enabled: ingestionIds.length > 0 && !!currentTenant
  });
  
  // Fetch opportunities
  const { data: opportunitiesData } = useQuery<{ ok: boolean; opportunities: Opportunity[] }>({
    queryKey: ['/api/contractor/ingestions/opportunities'],
    enabled: !!user && !!currentTenant
  });
  
  // Confirm ingestion mutation
  const confirmMutation = useMutation({
    mutationFn: async (ingestionId: string) => {
      const res = await apiRequest('POST', `/api/contractor/ingestions/${ingestionId}/confirm`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/ingestions'] });
    }
  });
  
  // Dismiss ingestion mutation
  const dismissMutation = useMutation({
    mutationFn: async (ingestionId: string) => {
      const res = await apiRequest('POST', `/api/contractor/ingestions/${ingestionId}/discard`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/ingestions'] });
    }
  });
  
  // Respond to opportunity mutation
  const respondOpportunityMutation = useMutation({
    mutationFn: async ({ id, response }: { id: string; response: 'accepted' | 'dismissed' }) => {
      const res = await apiRequest('POST', `/api/contractor/ingestions/opportunities/${id}/respond`, { response });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/ingestions/opportunities'] });
    }
  });
  
  const classifications = classificationsData?.classifications || [];
  const opportunities = opportunitiesData?.opportunities || [];
  
  const handleDone = () => {
    navigate('/app/contractor/onboard');
  };
  
  if (isLoading) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (ingestionIds.length === 0) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Upload Photos
            </CardTitle>
            <CardDescription>
              Start by uploading photos of your truck, tools, or sticky notes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/app/contractor/onboard')}>
              Go to Upload
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Here's What I Found</h1>
          </div>
          <p className="text-muted-foreground">
            Review what we detected from your photos. Accept to add to your profile.
          </p>
        </div>
        
        {classifications.length > 0 ? (
          <div className="space-y-4">
            {classifications.map((result) => (
              <ClassificationCard
                key={result.ingestionId}
                result={result}
                onAccept={() => confirmMutation.mutate(result.ingestionId)}
                onDismiss={() => dismissMutation.mutate(result.ingestionId)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No classifications found</p>
            </CardContent>
          </Card>
        )}
        
        {opportunities.length > 0 && (
          <div className="space-y-4 mt-8">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Growth Opportunities
            </h2>
            {opportunities.slice(0, 3).map((opp) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                onAccept={() => respondOpportunityMutation.mutate({ id: opp.id, response: 'accepted' })}
                onDismiss={() => respondOpportunityMutation.mutate({ id: opp.id, response: 'dismissed' })}
              />
            ))}
          </div>
        )}
        
        <div className="flex justify-center pt-4">
          <Button onClick={handleDone} size="lg" data-testid="button-done">
            Done
            <Check className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
