import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Truck, Clock, Search, ArrowRight, CheckCircle, 
  AlertCircle, Calendar, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCopy } from '@/copy/useCopy';

interface ServiceRun {
  id: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  portal_id: string | null;
  portal_name: string | null;
  zone_id: string | null;
  zone_name: string | null;
  requests_attached: number;
  created_at: string;
  updated_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  completed: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const formatSchedule = (startsAt: string | null, endsAt: string | null) => {
  if (!startsAt) return 'Not scheduled';
  const start = new Date(startsAt);
  const dateStr = start.toLocaleDateString('en-CA', { 
    month: 'short', day: 'numeric', year: 'numeric' 
  });
  const timeStr = start.toLocaleTimeString('en-CA', { 
    hour: '2-digit', minute: '2-digit' 
  });
  return `${dateStr} at ${timeStr}`;
};

export default function ProviderRunsPage() {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { nouns, resolve } = useCopy({ entryPoint: 'service' });

  const { data, isLoading, error } = useQuery<{ ok: boolean; runs: ServiceRun[] }>({
    queryKey: ['/api/provider/runs', filter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('filter', filter);
      if (searchQuery) params.set('search', searchQuery);
      const response = await fetch(`/api/provider/runs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch runs');
      return response.json();
    }
  });

  const runs = data?.runs || [];

  if (isLoading) {
    return (
      <div className="flex-1 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-12 bg-muted rounded" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-4">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold mb-2">Failed to load runs</h2>
            <p className="text-muted-foreground">Please try again later</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 space-y-4" data-testid="page-provider-runs">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Truck className="w-6 h-6" />
          <h1 className="text-xl font-bold" data-testid="text-runs-title">My Runs</h1>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search runs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="in_progress" data-testid="tab-in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          {runs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Truck className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-lg font-semibold mb-2" data-testid="text-empty-title">No runs found</h2>
                <p className="text-muted-foreground" data-testid="text-empty-description">
                  {filter === 'all' 
                    ? 'You have no service runs yet.'
                    : `No ${STATUS_LABELS[filter]?.toLowerCase() || filter} runs.`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <Link 
                  key={run.id} 
                  to={`/app/provider/runs/${run.id}`}
                  className="block"
                  data-testid={`link-run-${run.id}`}
                >
                  <Card className="hover-elevate cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={STATUS_COLORS[run.status] || STATUS_COLORS.scheduled} data-testid="badge-status">
                              {STATUS_LABELS[run.status] || run.status}
                            </Badge>
                            {run.portal_name && (
                              <Badge variant="outline" data-testid="badge-portal">
                                {run.portal_name}
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold truncate" data-testid="text-run-title">
                            {run.title || 'Untitled Run'}
                          </h3>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatSchedule(run.starts_at, run.ends_at)}
                            </span>
                            {run.zone_name && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {run.zone_name}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {run.requests_attached} requests
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
