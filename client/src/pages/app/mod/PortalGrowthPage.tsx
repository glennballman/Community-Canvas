import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { 
  Briefcase, CalendarRange, Package, Truck, Users, ChevronRight, Settings2, 
  Check, X, Loader2, UserCheck, Home, AlertTriangle, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Link } from 'wouter';

interface GrowthSwitchesResponse {
  ok: boolean;
  portalId: string;
  portalName: string;
  switches: {
    jobs_enabled: boolean;
    reservations_state: 'available' | 'request_only' | 'enabled';
    assets_enabled: boolean;
    service_runs_enabled: boolean;
    leads_enabled: boolean;
  };
  reservationsNextStep: {
    action: string;
    route: string;
  } | null;
  updatedAt: string;
}

interface GrowthMetricsResponse {
  ok: boolean;
  rangeDays: number;
  metrics: {
    bench: {
      readyCount: number;
      onSiteCount: number;
      clearedCount: number;
      prospectCount: number;
    };
    housing: {
      waitlistNewCount: number;
      waitlistOpenCount: number;
    };
    emergency: {
      createdCount: number;
      openCount: number;
      filledCount: number;
    };
  };
}

interface ModuleConfig {
  key: string;
  label: string;
  description: string;
  icon: any;
  switchKey: keyof GrowthSwitchesResponse['switches'];
  isToggle: boolean;
}

const MODULES: ModuleConfig[] = [
  {
    key: 'jobs',
    label: 'Jobs',
    description: 'Post job listings and receive applications from candidates',
    icon: Briefcase,
    switchKey: 'jobs_enabled',
    isToggle: true
  },
  {
    key: 'reservations',
    label: 'Reservations',
    description: 'Allow customers to request availability for your services',
    icon: CalendarRange,
    switchKey: 'reservations_state',
    isToggle: false
  },
  {
    key: 'assets',
    label: 'Assets',
    description: 'Track and manage physical assets and equipment',
    icon: Package,
    switchKey: 'assets_enabled',
    isToggle: true
  },
  {
    key: 'service_runs',
    label: 'Service Runs',
    description: 'Schedule and track service delivery routes',
    icon: Truck,
    switchKey: 'service_runs_enabled',
    isToggle: true
  },
  {
    key: 'leads',
    label: 'Leads',
    description: 'Capture and manage potential customer inquiries',
    icon: Users,
    switchKey: 'leads_enabled',
    isToggle: true
  }
];

function ModuleCard({ 
  config, 
  value, 
  reservationsNextStep,
  onToggle,
  isUpdating
}: { 
  config: ModuleConfig;
  value: boolean | string;
  reservationsNextStep: GrowthSwitchesResponse['reservationsNextStep'];
  onToggle: (key: string, newValue: boolean | string) => void;
  isUpdating: boolean;
}) {
  const [, navigate] = useLocation();
  const Icon = config.icon;
  
  const getStatus = () => {
    if (config.key === 'reservations') {
      switch (value) {
        case 'enabled': return { label: 'Enabled', variant: 'default' as const };
        case 'request_only': return { label: 'Request Only', variant: 'secondary' as const };
        default: return { label: 'Available', variant: 'outline' as const };
      }
    }
    return value ? { label: 'On', variant: 'default' as const } : { label: 'Off', variant: 'outline' as const };
  };

  const status = getStatus();

  const handleAction = () => {
    if (config.key === 'reservations' && reservationsNextStep) {
      navigate(reservationsNextStep.route);
    } else if (config.isToggle) {
      onToggle(config.switchKey, !value);
    }
  };

  const getActionLabel = () => {
    if (config.key === 'reservations' && reservationsNextStep) {
      switch (reservationsNextStep.action) {
        case 'enable': return 'Enable';
        case 'request': return 'Request Access';
        case 'manage': return 'Manage';
      }
    }
    return value ? 'Disable' : 'Enable';
  };

  return (
    <Card data-testid={`module-card-${config.key}`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10 shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold" data-testid={`text-${config.key}-label`}>{config.label}</h3>
              <Badge variant={status.variant} data-testid={`badge-${config.key}-status`}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
          </div>
          <Button
            variant={value ? 'outline' : 'default'}
            size="sm"
            onClick={handleAction}
            disabled={isUpdating}
            data-testid={`button-${config.key}-action`}
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {getActionLabel()}
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PortalGrowthPage() {
  const { portalId } = useParams<{ portalId: string }>();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<GrowthSwitchesResponse>({
    queryKey: ['/api/p2/app/mod/portals', portalId, 'growth-switches'],
    enabled: !!portalId
  });

  const { data: metricsData } = useQuery<GrowthMetricsResponse>({
    queryKey: ['/api/p2/app/mod/portals', portalId, 'growth-metrics'],
    enabled: !!portalId && !!data?.switches?.jobs_enabled
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<GrowthSwitchesResponse['switches']>) => {
      return apiRequest('PATCH', `/api/p2/app/mod/portals/${portalId}/growth-switches`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/mod/portals', portalId, 'growth-switches'] });
      toast({ title: 'Settings updated' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to update', 
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleToggle = (key: string, newValue: boolean | string) => {
    updateMutation.mutate({ [key]: newValue });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Settings2 className="h-8 w-8" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardContent className="py-12 text-center">
            <X className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-lg font-semibold">Failed to load growth settings</h2>
            <p className="text-muted-foreground">Please try again later</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl" data-testid="portal-growth-page">
      <div className="flex items-center gap-3 mb-8">
        <Settings2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{data.portalName} Growth</h1>
          <p className="text-muted-foreground">Enable modules to expand your portal capabilities</p>
        </div>
      </div>

      <div className="space-y-4">
        {MODULES.map(config => (
          <ModuleCard
            key={config.key}
            config={config}
            value={data.switches[config.switchKey]}
            reservationsNextStep={data.reservationsNextStep}
            onToggle={handleToggle}
            isUpdating={updateMutation.isPending}
          />
        ))}
      </div>

      {data.switches.jobs_enabled && metricsData?.ok && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 flex-wrap">
            <Briefcase className="h-5 w-5" />
            Jobs Module Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="metrics-card-bench">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <UserCheck className="h-4 w-4" />
                  Candidate Bench
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between items-center gap-2 flex-wrap" data-testid="text-bench-ready">
                    <span className="text-muted-foreground">Ready:</span>
                    <Badge variant="default">{metricsData.metrics.bench.readyCount}</Badge>
                  </div>
                  <div className="flex justify-between items-center gap-2 flex-wrap" data-testid="text-bench-onsite">
                    <span className="text-muted-foreground">On-site:</span>
                    <Badge variant="secondary">{metricsData.metrics.bench.onSiteCount}</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="w-full mt-3" data-testid="button-view-bench">
                  <Link to="/app/mod/bench">
                    View bench <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="metrics-card-housing">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <Home className="h-4 w-4" />
                  Housing Waitlist
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between items-center gap-2 flex-wrap" data-testid="text-housing-new">
                    <span className="text-muted-foreground">New:</span>
                    <Badge variant="default">{metricsData.metrics.housing.waitlistNewCount}</Badge>
                  </div>
                  <div className="flex justify-between items-center gap-2 flex-wrap" data-testid="text-housing-open">
                    <span className="text-muted-foreground">Open:</span>
                    <Badge variant="secondary">{metricsData.metrics.housing.waitlistOpenCount}</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="w-full mt-3" data-testid="button-view-housing">
                  <Link to="/app/mod/housing-waitlist?status=new">
                    View waitlist <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="metrics-card-emergency">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <AlertTriangle className="h-4 w-4" />
                  Emergency ({metricsData.rangeDays}d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between items-center gap-2 flex-wrap" data-testid="text-emergency-open">
                    <span className="text-muted-foreground">Open:</span>
                    <Badge variant="destructive">{metricsData.metrics.emergency.openCount}</Badge>
                  </div>
                  <div className="flex justify-between items-center gap-2 flex-wrap" data-testid="text-emergency-filled">
                    <span className="text-muted-foreground">Filled:</span>
                    <Badge variant="default">{metricsData.metrics.emergency.filledCount}</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild className="w-full mt-3" data-testid="button-view-emergency">
                  <Link to="/app/mod/emergency">
                    View requests <ExternalLink className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
