/**
 * IdentityProposalCard - Prompt A2.1
 * 
 * Displays identity proposal from vehicle photos with privacy-first design.
 * Supports propose/confirm/deny/change/dismiss workflow.
 * 
 * Privacy invariants:
 * - Locations shown as "Photo captured near..." not as facts
 * - No license plate numbers (only region if available)
 * - Web lookups require explicit consent button
 */

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Building2,
  Phone,
  Globe,
  MapPin,
  Check,
  X,
  Pencil,
  Clock,
  AlertTriangle,
  Loader2,
  Sparkles,
  ShieldCheck,
  Search
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface IdentityProposalEvidence {
  type: 'ocr_domain' | 'ocr_phone' | 'ocr_name' | 'ocr_social' | 'gps_hint' | 'plate_region';
  value: string;
}

interface WebEnrichment {
  website_title?: string;
  logo_url?: string;
  brand_colors?: string[];
  about_snippet?: string;
  fetched_at?: string;
}

interface IdentityProposal {
  company_name?: string;
  phone?: string;
  website?: string;
  location_hint?: string;
  likely_person?: string;
  confidence?: number;
  evidence?: IdentityProposalEvidence[];
  requires_consent_for_web_lookup?: boolean;
  web_enrichment?: WebEnrichment;
}

// Accept more flexible types for external data
interface ExternalIdentityProposal {
  company_name?: string;
  phone?: string;
  website?: string;
  location_hint?: string;
  likely_person?: string;
  confidence?: number;
  evidence?: Array<{ type: string; value: string }>;
  requires_consent_for_web_lookup?: boolean;
  web_enrichment?: WebEnrichment;
}

interface IdentityProposalCardProps {
  ingestionId: string;
  sourceType: string;
  existingProposal?: ExternalIdentityProposal;
  existingProposalStatus?: string;
  onComplete?: () => void;
}

export function IdentityProposalCard({ 
  ingestionId, 
  sourceType,
  existingProposal,
  existingProposalStatus,
  onComplete 
}: IdentityProposalCardProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState({
    company_name: existingProposal?.company_name || '',
    phone: existingProposal?.phone || '',
    website: existingProposal?.website || '',
    location_hint: existingProposal?.location_hint || ''
  });

  // Sync editedValues when existingProposal changes (e.g., after fetch)
  useEffect(() => {
    if (existingProposal && !isEditing) {
      setEditedValues({
        company_name: existingProposal.company_name || '',
        phone: existingProposal.phone || '',
        website: existingProposal.website || '',
        location_hint: existingProposal.location_hint || ''
      });
    }
  }, [existingProposal, isEditing]);

  // Only show for vehicle photos
  if (sourceType !== 'vehicle_photo') {
    return null;
  }

  // Fetch current identity state
  const { data: identityState } = useQuery<{
    success: boolean;
    identity: {
      state: string;
      company_name: string | null;
      phone: string | null;
      website: string | null;
      location_hint: string | null;
    };
  }>({
    queryKey: ['/api/contractor/profile/identity'],
  });

  // Propose mutation
  const proposeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/contractor/profile/identity/propose', {
        ingestion_id: ingestionId,
        allow_web_lookup: false
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.proposal) {
        setEditedValues({
          company_name: data.proposal.company_name || '',
          phone: data.proposal.phone || '',
          website: data.proposal.website || '',
          location_hint: data.proposal.location_hint || ''
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/profile/identity'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/ingestions', ingestionId] });
    }
  });

  // Web enrich mutation
  const webEnrichMutation = useMutation({
    mutationFn: async (domain: string) => {
      const res = await apiRequest('POST', '/api/contractor/profile/identity/enrich-web', {
        ingestion_id: ingestionId,
        domain_or_website: domain
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/profile/identity'] });
    }
  });

  // Confirm mutation
  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/contractor/profile/identity/confirm', {
        ingestion_id: ingestionId,
        ...editedValues
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/profile/identity'] });
      setIsEditing(false);
      onComplete?.();
    }
  });

  // Deny mutation  
  const denyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/contractor/profile/identity/deny', {
        ingestion_id: ingestionId
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/profile/identity'] });
      onComplete?.();
    }
  });

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/contractor/profile/identity/dismiss', {
        ingestion_id: ingestionId
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/profile/identity'] });
      onComplete?.();
    }
  });

  const isLoading = proposeMutation.isPending || confirmMutation.isPending || 
                    denyMutation.isPending || dismissMutation.isPending;
  
  // Use existing proposal from ingestion if available, otherwise use freshly generated one
  const freshProposal = proposeMutation.data?.proposal as IdentityProposal | undefined;
  const proposal = freshProposal || (existingProposalStatus === 'proposed' ? existingProposal : undefined);
  const hasProposal = proposal && (proposal.evidence?.length ?? 0) > 0;
  const identityConfirmed = identityState?.identity?.state === 'confirmed';
  const alreadyProposed = existingProposalStatus === 'proposed' && existingProposal;

  // If identity is already confirmed, show confirmation view
  if (identityConfirmed && identityState?.identity) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              Confirmed Identity
            </CardTitle>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Verified
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {identityState.identity.company_name && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-confirmed-company">{identityState.identity.company_name}</span>
            </div>
          )}
          {identityState.identity.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-confirmed-phone">{identityState.identity.phone}</span>
            </div>
          )}
          {identityState.identity.website && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span data-testid="text-confirmed-website">{identityState.identity.website}</span>
            </div>
          )}
          {identityState.identity.location_hint && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="italic" data-testid="text-confirmed-location">{identityState.identity.location_hint}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Initial state - offer to analyze
  if (!proposal && !proposeMutation.isError) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Business Identity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            We can detect your company info from vehicle branding in these photos.
          </p>
          <Button
            onClick={() => proposeMutation.mutate()}
            disabled={isLoading}
            className="w-full"
            data-testid="button-analyze-identity"
          >
            {proposeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Detect Business Info
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2"
            onClick={() => dismissMutation.mutate()}
            disabled={isLoading}
            data-testid="button-skip-identity"
          >
            <Clock className="h-4 w-4 mr-2" />
            Skip for now
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Editing mode
  if (isEditing) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Edit Business Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              value={editedValues.company_name}
              onChange={(e) => setEditedValues(v => ({ ...v, company_name: e.target.value }))}
              placeholder="Your business name"
              data-testid="input-company-name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={editedValues.phone}
              onChange={(e) => setEditedValues(v => ({ ...v, phone: e.target.value }))}
              placeholder="Contact number"
              data-testid="input-phone"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={editedValues.website}
              onChange={(e) => setEditedValues(v => ({ ...v, website: e.target.value }))}
              placeholder="https://example.com"
              data-testid="input-website"
            />
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsEditing(false)}
            disabled={isLoading}
            data-testid="button-cancel-edit"
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => confirmMutation.mutate()}
            disabled={isLoading}
            data-testid="button-save-identity"
          >
            {confirmMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Proposal result - show proposal or "no signals detected"
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Business Identity
          </CardTitle>
          {hasProposal && (
            <Badge variant="outline">
              {Math.round((proposal.confidence || 0) * 100)}% match
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasProposal ? (
          <>
            {proposal.company_name && (
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium" data-testid="text-proposal-company">
                  {proposal.company_name}
                </span>
              </div>
            )}
            {proposal.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm" data-testid="text-proposal-phone">{proposal.phone}</span>
              </div>
            )}
            {proposal.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm" data-testid="text-proposal-website">{proposal.website}</span>
                {proposal.requires_consent_for_web_lookup && !proposal.web_enrichment && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => webEnrichMutation.mutate(proposal.website!)}
                    disabled={webEnrichMutation.isPending}
                    data-testid="button-lookup-website"
                  >
                    {webEnrichMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Search className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            )}
            {proposal.location_hint && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span className="text-sm italic" data-testid="text-proposal-location">
                  {proposal.location_hint}
                </span>
              </div>
            )}
            
            <div className="pt-2 border-t space-y-2">
              <p className="text-xs text-muted-foreground">
                Is this your business? Confirm, edit, or dismiss.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => confirmMutation.mutate()}
                  disabled={isLoading}
                  data-testid="button-confirm-identity"
                >
                  {confirmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  disabled={isLoading}
                  data-testid="button-edit-identity"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => denyMutation.mutate()}
                  disabled={isLoading}
                  data-testid="button-deny-identity"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <p className="text-sm">
                No business info detected from these photos. You can enter your details manually.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditedValues({
                    company_name: '',
                    phone: '',
                    website: '',
                    location_hint: ''
                  });
                  setIsEditing(true);
                }}
                data-testid="button-enter-manually"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Enter Manually
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissMutation.mutate()}
                disabled={isLoading}
                data-testid="button-skip-identity-later"
              >
                <Clock className="h-4 w-4 mr-2" />
                Later
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default IdentityProposalCard;
