import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { 
  Home, Clock, User, Mail, Calendar, MessageSquare, 
  Search, Filter, ChevronDown, Loader2, X, Check
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface WaitlistEntry {
  id: string;
  portalId: string;
  bundleId: string | null;
  applicationId: string | null;
  applicantName: string;
  applicantEmail: string;
  preferredStartDate: string | null;
  preferredEndDate: string | null;
  budgetNote: string | null;
  status: 'new' | 'contacted' | 'matched' | 'waitlisted' | 'closed';
  assignedToIdentityId: string | null;
  notes: string | null;
  housingTierAssigned: 'premium' | 'standard' | 'temporary' | 'emergency' | null;
  stagingLocationNote: string | null;
  stagingStartDate: string | null;
  stagingEndDate: string | null;
  matchedHousingOfferId: string | null;
  priorityScore: number | null;
  createdAt: string;
  updatedAt: string;
  hoursSinceCreated: number;
}

interface WaitlistResponse {
  ok: boolean;
  entries: WaitlistEntry[];
  total: number;
  limit: number;
  offset: number;
}

const STATUS_OPTIONS = [
  { value: 'new', label: 'New', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { value: 'matched', label: 'Matched', color: 'bg-green-500' },
  { value: 'waitlisted', label: 'Waitlisted', color: 'bg-purple-500' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-500' }
];

const TIER_OPTIONS = [
  { value: 'premium', label: 'Premium', color: 'bg-amber-500' },
  { value: 'standard', label: 'Standard', color: 'bg-blue-400' },
  { value: 'temporary', label: 'Temporary', color: 'bg-orange-400' },
  { value: 'emergency', label: 'Emergency', color: 'bg-red-400' }
];

function AgeBadge({ hours }: { hours: number }) {
  let variant: 'default' | 'secondary' | 'destructive' = 'secondary';
  let label = `${hours}h`;
  
  if (hours >= 72) {
    variant = 'destructive';
    label = `${Math.floor(hours / 24)}d`;
  } else if (hours >= 24) {
    variant = 'default';
    label = `${Math.floor(hours / 24)}d`;
  }

  return (
    <Badge variant={variant} className="text-xs">
      <Clock className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

function WaitlistRow({ 
  entry, 
  onStatusChange,
  onNotesChange,
  isUpdating 
}: { 
  entry: WaitlistEntry;
  onStatusChange: (id: string, status: string) => void;
  onNotesChange: (id: string, notes: string) => void;
  isUpdating: boolean;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [localNotes, setLocalNotes] = useState(entry.notes || '');

  const statusOption = STATUS_OPTIONS.find(s => s.value === entry.status);

  return (
    <Card data-testid={`waitlist-entry-${entry.id}`}>
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium" data-testid="text-applicant-name">{entry.applicantName}</span>
              <AgeBadge hours={entry.hoursSinceCreated} />
              <Badge variant="outline" className="text-xs" data-testid={`badge-source-${entry.id}`}>
                {entry.bundleId ? 'Campaign' : 'Direct'}
              </Badge>
              {entry.housingTierAssigned && (
                <Badge 
                  variant="secondary" 
                  className="text-xs"
                  data-testid={`badge-tier-${entry.id}`}
                >
                  <Home className="h-3 w-3 mr-1" />
                  {TIER_OPTIONS.find(t => t.value === entry.housingTierAssigned)?.label}
                </Badge>
              )}
              {entry.priorityScore !== null && entry.priorityScore > 0 && (
                <Badge variant="outline" className="text-xs">
                  P{entry.priorityScore}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {entry.applicantEmail}
              </span>
              {entry.preferredStartDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(entry.preferredStartDate).toLocaleDateString()}
                </span>
              )}
            </div>
            {entry.budgetNote && (
              <p className="text-sm mt-2 text-muted-foreground">{entry.budgetNote}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={entry.status}
              onValueChange={(value) => onStatusChange(entry.id, value)}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-32" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
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
              onClick={() => setShowNotes(!showNotes)}
              data-testid="button-toggle-notes"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showNotes && (
          <div className="mt-4 pt-4 border-t">
            <Textarea
              placeholder="Add notes..."
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              className="mb-2"
              data-testid="input-notes"
            />
            <Button
              size="sm"
              onClick={() => onNotesChange(entry.id, localNotes)}
              disabled={isUpdating || localNotes === entry.notes}
              data-testid="button-save-notes"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Notes'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HousingWaitlistPage() {
  const { portalId } = useParams<{ portalId: string }>();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error } = useQuery<WaitlistResponse>({
    queryKey: ['/api/p2/app/mod/portals', portalId, 'housing-waitlist', { status: statusFilter, q: searchQuery }],
    enabled: !!portalId
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return apiRequest('PATCH', `/api/p2/app/mod/housing-waitlist/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/p2/app/mod/portals', portalId, 'housing-waitlist'] 
      });
      toast({ title: 'Entry updated' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleStatusChange = (id: string, status: string) => {
    updateMutation.mutate({ id, updates: { status } });
  };

  const handleNotesChange = (id: string, notes: string) => {
    updateMutation.mutate({ id, updates: { notes } });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Home className="h-8 w-8" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardContent className="py-12 text-center">
            <X className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold">Failed to load housing waitlist</h2>
            <p className="text-muted-foreground">Please try again later</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const entries = data?.entries || [];
  const total = data?.total || 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl" data-testid="housing-waitlist-page">
      <div className="flex items-center gap-3 mb-8">
        <Home className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Housing Waitlist</h1>
          <p className="text-muted-foreground">
            {total} candidate{total !== 1 ? 's' : ''} need{total === 1 ? 's' : ''} housing assistance
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-filter-status">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="" data-testid="select-item-all">All Status</SelectItem>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value} data-testid={`select-item-${opt.value}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                  {opt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold">No waitlist entries</h2>
            <p className="text-muted-foreground">
              {statusFilter ? 'No entries match this filter' : 'Candidates with housing needs will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entries.map(entry => (
            <WaitlistRow
              key={entry.id}
              entry={entry}
              onStatusChange={handleStatusChange}
              onNotesChange={handleNotesChange}
              isUpdating={updateMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
