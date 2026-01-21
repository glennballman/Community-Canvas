/**
 * ServiceAreaProposalCard - A2.2 Service Area Proposal UI
 * 
 * Displays proposed service areas based on contractor uploads and allows:
 * - Accept (with publish preference)
 * - Adjust (modify coverage)
 * - Dismiss (skip this proposal)
 * 
 * PRINCIPLES:
 * - Advisory only - nothing restricts future jobs
 * - Everything is editable later
 * - Consent-first - contractor confirms or adjusts
 * - Never auto-publish without confirmation
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  MapPin, 
  Route, 
  CircleDot, 
  Building2, 
  Check, 
  X, 
  Pencil,
  Globe,
  Lock,
  Loader2,
  Camera,
  FileText,
  Map
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

type CoverageType = 'zone' | 'portal' | 'radius' | 'route';

interface ServiceAreaProposal {
  id: string;
  coverage_type: CoverageType;
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

interface ServiceAreaProposalCardProps {
  proposals: ServiceAreaProposal[];
  onComplete?: () => void;
  onSkip?: () => void;
}

const coverageTypeConfig: Record<CoverageType, { icon: typeof MapPin; color: string; label: string }> = {
  portal: { icon: Building2, color: 'bg-blue-500/10 text-blue-600 border-blue-200', label: 'Community' },
  zone: { icon: Map, color: 'bg-green-500/10 text-green-600 border-green-200', label: 'Zone' },
  route: { icon: Route, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-200', label: 'Route' },
  radius: { icon: CircleDot, color: 'bg-purple-500/10 text-purple-600 border-purple-200', label: 'Radius' }
};

const sourceConfig: Record<string, { icon: typeof Camera; label: string }> = {
  job_photo: { icon: Camera, label: 'Photo GPS' },
  sticky_note: { icon: FileText, label: 'Sticky note' },
  identity_enrichment: { icon: Building2, label: 'Company location' },
  service_run_pattern: { icon: Route, label: 'Work history' },
  manual: { icon: Pencil, label: 'Manual entry' }
};

function ProposalItem({ 
  proposal, 
  onAccept, 
  onDismiss,
  isSubmitting
}: { 
  proposal: ServiceAreaProposal;
  onAccept: (proposal: ServiceAreaProposal, isPublished: boolean) => void;
  onDismiss: (proposalId: string) => void;
  isSubmitting: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [radiusKm, setRadiusKm] = useState(proposal.coverage_payload.radius_km || 15);
  const [isPublished, setIsPublished] = useState(false);
  
  const config = coverageTypeConfig[proposal.coverage_type];
  const sourceInfo = sourceConfig[proposal.source] || { icon: MapPin, label: proposal.source };
  const Icon = config.icon;
  const SourceIcon = sourceInfo.icon;
  
  const getLocationLabel = () => {
    if (proposal.portal_name) return proposal.portal_name;
    if (proposal.zone_label) return proposal.zone_label;
    if (proposal.coverage_payload.from && proposal.coverage_payload.to) {
      return `${proposal.coverage_payload.from} → ${proposal.coverage_payload.to}`;
    }
    if (proposal.coverage_payload.lat && proposal.coverage_payload.lng) {
      return `Area near ${proposal.coverage_payload.lat.toFixed(2)}°, ${proposal.coverage_payload.lng.toFixed(2)}°`;
    }
    return 'Service area';
  };
  
  const handleAccept = () => {
    const modifiedProposal = isEditing && proposal.coverage_type === 'radius' 
      ? { ...proposal, coverage_payload: { ...proposal.coverage_payload, radius_km: radiusKm } }
      : proposal;
    onAccept(modifiedProposal, isPublished);
  };
  
  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-md ${config.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={config.color}>
                {config.label}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <SourceIcon className="h-3 w-3" />
                {sourceInfo.label}
              </span>
            </div>
            
            <h4 className="font-medium mt-1">{getLocationLabel()}</h4>
            
            {proposal.coverage_type === 'radius' && (
              <p className="text-sm text-muted-foreground mt-1">
                {isEditing ? radiusKm : proposal.coverage_payload.radius_km}km coverage radius
              </p>
            )}
            
            {proposal.coverage_type === 'route' && proposal.coverage_payload.buffer_km && (
              <p className="text-sm text-muted-foreground mt-1">
                {proposal.coverage_payload.buffer_km}km corridor
              </p>
            )}
            
            {proposal.evidence && proposal.evidence.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {proposal.evidence.map((e, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {e}
                  </Badge>
                ))}
              </div>
            )}
            
            <div className="w-full bg-muted rounded-full h-1.5 mt-3">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all" 
                style={{ width: `${proposal.confidence * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(proposal.confidence * 100)}% confidence
            </p>
          </div>
        </div>
        
        {isEditing && proposal.coverage_type === 'radius' && (
          <div className="mt-4 p-3 bg-muted/50 rounded-md">
            <Label className="text-sm">Adjust coverage radius</Label>
            <div className="flex items-center gap-4 mt-2">
              <Slider
                value={[radiusKm]}
                onValueChange={(v) => setRadiusKm(v[0])}
                min={5}
                max={100}
                step={5}
                className="flex-1"
              />
              <span className="text-sm font-medium w-16">{radiusKm}km</span>
            </div>
          </div>
        )}
        
        <div className="mt-4 p-3 bg-muted/30 rounded-md border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPublished ? (
                <Globe className="h-4 w-4 text-primary" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor={`publish-${proposal.id}`} className="text-sm font-medium cursor-pointer">
                  {isPublished ? 'Accept work requests here' : 'Keep this private'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isPublished 
                    ? 'Work requests in this area will be visible to you' 
                    : 'Only you can see this coverage area'}
                </p>
              </div>
            </div>
            <Switch 
              id={`publish-${proposal.id}`}
              checked={isPublished}
              onCheckedChange={setIsPublished}
            />
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-2 pt-0">
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleAccept}
          disabled={isSubmitting}
          className="flex-1"
          data-testid={`button-accept-area-${proposal.id}`}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
          Accept
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsEditing(!isEditing)}
          disabled={proposal.coverage_type !== 'radius'}
          data-testid={`button-adjust-area-${proposal.id}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onDismiss(proposal.id)}
          disabled={isSubmitting}
          data-testid={`button-dismiss-area-${proposal.id}`}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export function ServiceAreaProposalCard({ 
  proposals: initialProposals,
  onComplete,
  onSkip
}: ServiceAreaProposalCardProps) {
  const queryClient = useQueryClient();
  const [proposals, setProposals] = useState(initialProposals);
  const [accepted, setAccepted] = useState<Array<{ proposal: ServiceAreaProposal; is_published: boolean }>>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  
  const confirmMutation = useMutation({
    mutationFn: async (data: { 
      accepted: Array<{ proposal: ServiceAreaProposal; is_published: boolean }>;
      dismissed: string[];
    }) => {
      return apiRequest('/api/contractor/profile/service-areas/confirm', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/profile/service-areas'] });
      onComplete?.();
    }
  });
  
  const handleAccept = (proposal: ServiceAreaProposal, isPublished: boolean) => {
    setAccepted(prev => [...prev, { proposal, is_published: isPublished }]);
    setProposals(prev => prev.filter(p => p.id !== proposal.id));
  };
  
  const handleDismiss = (proposalId: string) => {
    setDismissed(prev => [...prev, proposalId]);
    setProposals(prev => prev.filter(p => p.id !== proposalId));
  };
  
  const handleSaveAll = () => {
    confirmMutation.mutate({ accepted, dismissed });
  };
  
  const handleSkipAll = () => {
    onSkip?.();
  };
  
  if (initialProposals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Service Areas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No service areas detected yet. Upload more photos with location data 
            or add sticky notes with place names to help us understand where you work.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={handleSkipAll} data-testid="button-skip-service-areas">
            Skip for now
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  const hasUnsavedChanges = accepted.length > 0 || dismissed.length > 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Where do you usually take work?
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Based on what you've uploaded, here's where it looks like you usually work. 
          This helps us surface nearby work requests, but nothing is shared unless you say yes.
        </p>
      </CardHeader>
      
      <CardContent>
        {proposals.map(proposal => (
          <ProposalItem
            key={proposal.id}
            proposal={proposal}
            onAccept={handleAccept}
            onDismiss={handleDismiss}
            isSubmitting={confirmMutation.isPending}
          />
        ))}
        
        {accepted.length > 0 && proposals.length === 0 && (
          <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-700 dark:text-green-300">
              <Check className="h-4 w-4 inline mr-1" />
              {accepted.length} service area(s) ready to save
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between gap-2">
        <Button 
          variant="ghost" 
          onClick={handleSkipAll}
          disabled={confirmMutation.isPending}
          data-testid="button-skip-service-areas"
        >
          I just want to view my jobs right now
        </Button>
        
        {hasUnsavedChanges && (
          <Button 
            onClick={handleSaveAll}
            disabled={confirmMutation.isPending}
            data-testid="button-save-service-areas"
          >
            {confirmMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            Save {accepted.length} area(s)
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
