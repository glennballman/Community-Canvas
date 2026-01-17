import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { 
  Users, Clock, User, Mail, MapPin, Home, Briefcase,
  Search, Filter, ChevronDown, Loader2, X, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface BenchCandidate {
  id: string;
  portalId: string;
  individualId: string;
  individualName: string;
  individualEmail: string;
  readinessState: 'prospect' | 'cleared' | 'ready' | 'on_site' | 'placed' | 'inactive';
  housingNeeded: boolean;
  housingTierPreference: 'premium' | 'standard' | 'temporary' | 'emergency' | null;
  locationNote: string | null;
  staffNotes: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  daysSinceActivity: number;
}

interface BenchResponse {
  ok: boolean;
  candidates: BenchCandidate[];
  total: number;
  limit: number;
  offset: number;
}

interface TimelineEntry {
  type: 'application' | 'housing' | 'event';
  date: string;
  title: string;
  detail: string | null;
  status: string | null;
}

interface TimelineResponse {
  ok: boolean;
  candidate: BenchCandidate;
  timeline: TimelineEntry[];
}

const READINESS_OPTIONS = [
  { value: 'prospect', label: 'Prospect', color: 'bg-gray-400' },
  { value: 'cleared', label: 'Cleared', color: 'bg-blue-400' },
  { value: 'ready', label: 'Ready', color: 'bg-green-400' },
  { value: 'on_site', label: 'On Site', color: 'bg-yellow-400' },
  { value: 'placed', label: 'Placed', color: 'bg-purple-400' },
  { value: 'inactive', label: 'Inactive', color: 'bg-red-400' }
];

const HOUSING_TIERS = [
  { value: 'premium', label: 'Premium' },
  { value: 'standard', label: 'Standard' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'emergency', label: 'Emergency' }
];

function ActivityBadge({ days }: { days: number }) {
  let variant: 'default' | 'secondary' | 'destructive' = 'secondary';
  let label = 'Active today';
  
  if (days >= 14) {
    variant = 'destructive';
    label = `${days}d ago`;
  } else if (days >= 7) {
    variant = 'default';
    label = `${days}d ago`;
  } else if (days > 0) {
    label = `${days}d ago`;
  }

  return (
    <Badge variant={variant} className="text-xs">
      <Clock className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

function ReadinessBadge({ state }: { state: string }) {
  const opt = READINESS_OPTIONS.find(o => o.value === state);
  return (
    <Badge variant="outline" className="text-xs">
      <div className={`w-2 h-2 rounded-full mr-1 ${opt?.color || 'bg-gray-400'}`} />
      {opt?.label || state}
    </Badge>
  );
}

function BenchRow({ 
  candidate, 
  onStateChange,
  onViewTimeline,
  isUpdating 
}: { 
  candidate: BenchCandidate;
  onStateChange: (id: string, state: string) => void;
  onViewTimeline: (id: string) => void;
  isUpdating: boolean;
}) {
  return (
    <Card data-testid={`bench-candidate-${candidate.id}`}>
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium" data-testid="text-candidate-name">{candidate.individualName}</span>
              <ReadinessBadge state={candidate.readinessState} />
              <ActivityBadge days={candidate.daysSinceActivity} />
              {candidate.housingNeeded && (
                <Badge variant="secondary" className="text-xs">
                  <Home className="h-3 w-3 mr-1" />
                  Housing Needed
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {candidate.individualEmail}
              </span>
              {candidate.locationNote && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {candidate.locationNote}
                </span>
              )}
              {candidate.housingTierPreference && (
                <span className="flex items-center gap-1">
                  <Home className="h-3 w-3" />
                  Tier: {candidate.housingTierPreference}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={candidate.readinessState}
              onValueChange={(value) => onStateChange(candidate.id, value)}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-28" data-testid="select-readiness">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {READINESS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onViewTimeline(candidate.id)}
              data-testid="button-view-timeline"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineDrawer({ 
  benchId, 
  portalId,
  open, 
  onClose 
}: { 
  benchId: string | null; 
  portalId: string;
  open: boolean; 
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<TimelineResponse>({
    queryKey: ['/api/p2/app/mod/portals', portalId, 'bench', benchId, 'timeline'],
    enabled: !!benchId && open
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle data-testid="text-timeline-title">
            {data?.candidate?.individualName || 'Candidate Timeline'}
          </SheetTitle>
          <SheetDescription>
            Application history and activity
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : data?.timeline?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No activity yet</p>
          ) : (
            <div className="space-y-4">
              {data?.timeline?.map((entry, idx) => (
                <Card key={idx} data-testid={`timeline-entry-${idx}`}>
                  <CardContent className="py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {entry.type === 'application' && <Briefcase className="h-4 w-4 text-blue-500" />}
                        {entry.type === 'housing' && <Home className="h-4 w-4 text-green-500" />}
                        {entry.type === 'event' && <Clock className="h-4 w-4 text-gray-500" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{entry.title}</p>
                        {entry.detail && (
                          <p className="text-sm text-muted-foreground">{entry.detail}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(entry.date).toLocaleDateString()}
                        </p>
                      </div>
                      {entry.status && (
                        <Badge variant="outline" className="text-xs">{entry.status}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default function BenchPage() {
  const { portalId } = useParams<{ portalId: string }>();
  const { toast } = useToast();
  const [stateFilter, setStateFilter] = useState<string>('');
  const [housingFilter, setHousingFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [timelineBenchId, setTimelineBenchId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<BenchResponse>({
    queryKey: ['/api/p2/app/mod/portals', portalId, 'bench', { state: stateFilter, housing: housingFilter, q: searchQuery }],
    enabled: !!portalId
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiRequest('PATCH', `/api/p2/app/mod/bench/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/p2/app/mod/portals', portalId, 'bench'] 
      });
      toast({ title: 'Candidate updated' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleStateChange = (id: string, readinessState: string) => {
    updateMutation.mutate({ id, updates: { readiness_state: readinessState } });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">Failed to load bench candidates</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6" />
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Candidate Bench</h1>
          <Badge variant="secondary" className="ml-2" data-testid="badge-total-count">
            {data?.total || 0}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search candidates..."
              className="pl-8 w-48"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
          
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-32" data-testid="select-filter-state">
              <SelectValue placeholder="All states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All states</SelectItem>
              {READINESS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={housingFilter} onValueChange={setHousingFilter}>
            <SelectTrigger className="w-32" data-testid="select-filter-housing">
              <SelectValue placeholder="Housing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All</SelectItem>
              <SelectItem value="yes">Needs Housing</SelectItem>
              <SelectItem value="no">No Housing Need</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {data?.candidates?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No candidates on the bench yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Candidates are added automatically when they apply via campaigns
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data?.candidates?.map(candidate => (
            <BenchRow
              key={candidate.id}
              candidate={candidate}
              onStateChange={handleStateChange}
              onViewTimeline={(id) => setTimelineBenchId(id)}
              isUpdating={updateMutation.isPending}
            />
          ))}
        </div>
      )}

      <TimelineDrawer
        benchId={timelineBenchId}
        portalId={portalId || ''}
        open={!!timelineBenchId}
        onClose={() => setTimelineBenchId(null)}
      />
    </div>
  );
}
