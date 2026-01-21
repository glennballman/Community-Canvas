/**
 * A2.4: Location Resolution Block
 * 
 * Displays geo candidates from photo EXIF/OCR with options to:
 * - Confirm: Link address to business graph entity
 * - Change: Search for different address
 * - Deny: Mark as incorrect location
 * - Skip: Do nothing, keep as advisory only
 * 
 * IMPORTANT: Never auto-creates entities - only proposes
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, 
  Check, 
  X, 
  Search, 
  Loader2, 
  Building2, 
  User, 
  Briefcase,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useTenant } from '@/contexts/TenantContext';

interface StoredCandidate {
  id: string;
  lat: string | null;
  lng: string | null;
  formattedAddress: string;
  confidence: string;
  provider: string | null;
  source: string;
  addressComponents: Record<string, any>;
  normalizedAddressHash: string;
}

interface GeoCandidate {
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  confidence: number;
  provider: string;
  normalizedAddressHash?: string;
}

interface EntityMatch {
  entityType: 'customer' | 'jobsite' | 'work_request';
  entityId: string;
  matchType: 'exact_hash' | 'proximity' | 'contact_match';
  confidence: number;
  label: string;
}

interface DraftProposal {
  type: 'create_customer' | 'create_jobsite' | 'attach_to_existing';
  suggestedData: Record<string, any>;
  reason: string;
}

interface GeoResolutionResponse {
  ok: boolean;
  success: boolean;
  candidates: StoredCandidate[];
  matches: EntityMatch[];
  proposals: DraftProposal[];
  reasoning: string[];
}

interface LocationResolutionBlockProps {
  ingestionId: string;
  photoBundleId?: string;
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
  source?: string;
  onResolved?: (result: { confirmed: boolean; entityId?: string }) => void;
}

function getEntityIcon(type: string) {
  switch (type) {
    case 'customer':
      return <User className="h-4 w-4" />;
    case 'jobsite':
      return <MapPin className="h-4 w-4" />;
    case 'work_request':
      return <Briefcase className="h-4 w-4" />;
    default:
      return <Building2 className="h-4 w-4" />;
  }
}

function getMatchTypeLabel(type: string): string {
  switch (type) {
    case 'exact_hash':
      return 'Exact Match';
    case 'proximity':
      return 'Nearby';
    case 'contact_match':
      return 'Contact Match';
    default:
      return type;
  }
}

export function LocationResolutionBlock({
  ingestionId,
  photoBundleId,
  initialAddress,
  initialLat,
  initialLng,
  source = 'exif',
  onResolved
}: LocationResolutionBlockProps) {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GeoCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<StoredCandidate | null>(null);
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'denied' | 'skipped'>('pending');

  const headers = {
    'Content-Type': 'application/json',
    'x-tenant-id': currentTenant?.tenant_id || ''
  };

  const { data: resolutionData, isLoading: isResolving } = useQuery<GeoResolutionResponse>({
    queryKey: ['/api/contractor/geo/resolve', ingestionId, photoBundleId],
    queryFn: async () => {
      const res = await fetch('/api/contractor/geo/resolve', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ingestion_id: ingestionId,
          photo_bundle_id: photoBundleId,
        })
      });
      return res.json();
    },
    enabled: !!(initialLat && initialLng) || !!initialAddress,
    staleTime: 1000 * 60 * 5
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ 
      candidateId, 
      entityType, 
      entityId,
      manualAddressText,
      lat,
      lng
    }: { 
      candidateId?: string; 
      entityType?: string; 
      entityId?: string;
      manualAddressText?: string;
      lat?: number;
      lng?: number;
    }) => {
      const res = await fetch('/api/contractor/geo/confirm', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          candidate_id: candidateId,
          entity_type: entityType,
          entity_id: entityId,
          manual_address_text: manualAddressText,
          lat,
          lng
        })
      });
      return res.json();
    },
    onSuccess: (data) => {
      setStatus('confirmed');
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/geo'] });
      onResolved?.({ confirmed: true, entityId: data.link?.entityId });
    }
  });

  const denyMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const res = await fetch('/api/contractor/geo/deny', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ 
          candidate_id: candidateId,
          ingestion_id: ingestionId,
          photo_bundle_id: photoBundleId 
        })
      });
      return res.json();
    },
    onSuccess: () => {
      setStatus('denied');
      queryClient.invalidateQueries({ queryKey: ['/api/contractor/geo'] });
      onResolved?.({ confirmed: false });
    }
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const res = await fetch('/api/contractor/geo/search', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ 
          query: searchQuery,
          country_code: 'ca'
        })
      });
      const data = await res.json();
      if (data.ok) {
        setSearchResults(data.candidates || []);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSkip = () => {
    setStatus('skipped');
    onResolved?.({ confirmed: false });
  };

  const candidates = resolutionData?.candidates || [];
  const matches = resolutionData?.matches || [];
  const proposals = resolutionData?.proposals || [];
  const primaryCandidate = selectedCandidate || candidates[0];

  if (status === 'confirmed') {
    return (
      <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-green-500/10 border border-green-500/20">
        <Check className="h-4 w-4 text-green-600" />
        <MapPin className="h-4 w-4 text-green-600" />
        <span className="text-green-700">Location confirmed</span>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-red-500/10 border border-red-500/20">
        <X className="h-4 w-4 text-red-600" />
        <MapPin className="h-4 w-4 text-red-600" />
        <span className="text-red-700">Location marked as incorrect</span>
      </div>
    );
  }

  if (status === 'skipped') {
    return (
      <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-muted/50">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground italic">Location skipped (advisory only)</span>
      </div>
    );
  }

  if (!initialAddress && !initialLat) {
    return null;
  }

  if (isResolving) {
    return (
      <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-muted/50">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-muted-foreground">Resolving location...</span>
      </div>
    );
  }

  return (
    <Card className="overflow-visible" data-testid="location-resolution-block">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium">Location</CardTitle>
            {primaryCandidate && (
              <Badge variant="secondary" className="text-xs">
                {Math.round(parseFloat(primaryCandidate.confidence))}% confidence
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-toggle-location"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {primaryCandidate ? (
          <div className="text-sm">
            <span className="text-muted-foreground italic">Photo captured near: </span>
            <span>{primaryCandidate.formattedAddress}</span>
          </div>
        ) : initialAddress ? (
          <div className="text-sm">
            <span className="text-muted-foreground italic">Detected address: </span>
            <span>{initialAddress}</span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic">
            GPS coordinates: {initialLat?.toFixed(6)}, {initialLng?.toFixed(6)}
          </div>
        )}

        {matches.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Possible Matches:</div>
            {matches.slice(0, 3).map((match, idx) => (
              <div 
                key={`${match.entityType}-${match.entityId}`}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 hover-elevate cursor-pointer"
                onClick={() => {
                  if (primaryCandidate) {
                    if (primaryCandidate.id.startsWith('search-')) {
                      confirmMutation.mutate({
                        entityType: match.entityType,
                        entityId: match.entityId,
                        manualAddressText: primaryCandidate.formattedAddress,
                        lat: primaryCandidate.lat ? parseFloat(primaryCandidate.lat) : undefined,
                        lng: primaryCandidate.lng ? parseFloat(primaryCandidate.lng) : undefined
                      });
                    } else {
                      confirmMutation.mutate({
                        candidateId: primaryCandidate.id,
                        entityType: match.entityType,
                        entityId: match.entityId
                      });
                    }
                  }
                }}
                data-testid={`match-${idx}`}
              >
                <div className="flex items-center gap-2">
                  {getEntityIcon(match.entityType)}
                  <div>
                    <div className="text-sm font-medium">{match.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {match.entityType} · {getMatchTypeLabel(match.matchType)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Progress value={match.confidence * 100} className="h-1.5 w-12" />
                  <span className="text-xs text-muted-foreground">{Math.round(match.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {isExpanded && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Search for a different address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
                data-testid="input-address-search"
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleSearch}
                disabled={isSearching}
                data-testid="button-search-address"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-md cursor-pointer bg-muted/30 hover-elevate"
                    onClick={() => {
                      const stored: StoredCandidate = {
                        id: `search-${idx}`,
                        lat: result.lat?.toString() || null,
                        lng: result.lng?.toString() || null,
                        formattedAddress: result.formattedAddress,
                        confidence: result.confidence.toString(),
                        provider: result.provider,
                        source: 'manual_search',
                        addressComponents: {},
                        normalizedAddressHash: result.normalizedAddressHash || ''
                      };
                      setSelectedCandidate(stored);
                    }}
                    data-testid={`search-result-${idx}`}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{result.formattedAddress}</span>
                  </div>
                ))}
              </div>
            )}

            {candidates.length > 1 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Other candidates:</div>
                {candidates.slice(1).map((candidate, idx) => (
                  <div
                    key={candidate.id}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer ${
                      selectedCandidate?.id === candidate.id ? 'bg-primary/10 border border-primary/30' : 'bg-muted/30 hover-elevate'
                    }`}
                    onClick={() => setSelectedCandidate(candidate)}
                    data-testid={`candidate-${idx + 1}`}
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm flex-1">{candidate.formattedAddress}</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(parseFloat(candidate.confidence))}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {proposals.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Suggestions:</div>
                {proposals.map((proposal, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-2 p-2 rounded-md bg-primary/5 border border-primary/10 text-xs"
                  >
                    <AlertCircle className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                    <span>{proposal.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            data-testid="button-skip-location"
          >
            Skip
          </Button>
          {primaryCandidate && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => denyMutation.mutate(primaryCandidate.id)}
                disabled={denyMutation.isPending}
                data-testid="button-deny-location"
              >
                {denyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
                Wrong
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  // Check if it's a manual search result (id starts with 'search-')
                  if (primaryCandidate.id.startsWith('search-')) {
                    confirmMutation.mutate({
                      manualAddressText: primaryCandidate.formattedAddress,
                      lat: primaryCandidate.lat ? parseFloat(primaryCandidate.lat) : undefined,
                      lng: primaryCandidate.lng ? parseFloat(primaryCandidate.lng) : undefined
                    });
                  } else {
                    confirmMutation.mutate({ candidateId: primaryCandidate.id });
                  }
                }}
                disabled={confirmMutation.isPending}
                data-testid="button-confirm-location"
              >
                {confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Confirm
              </Button>
            </>
          )}
        </div>

        {matches.length === 0 && proposals.length === 0 && primaryCandidate && (
          <div className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <span className="text-amber-700">
              This location doesn't match any existing customers or jobsites. Confirming will store the location for future matching.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
