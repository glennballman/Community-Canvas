import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, Users, Clock, Home, FileCheck, Building2, 
  Share2, Copy, Check, ExternalLink, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface HiringPulseMetrics {
  newApplicationsCount: number;
  applicationsByStatus: Record<string, number>;
  medianFirstResponseMinutes: number | null;
  housingNeededCount: number;
  workPermitQuestionsCount: number;
  topEmployersByApplications: Array<{
    tenantId: string;
    tenantName: string;
    applicationCount: number;
  }>;
}

interface ShareLink {
  label: string;
  url: string;
}

interface HiringPulseResponse {
  ok: boolean;
  range: string;
  portalName: string;
  metrics: HiringPulseMetrics;
  shareLinks: ShareLink[];
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500',
  reviewing: 'bg-yellow-500',
  interviewing: 'bg-purple-500',
  offered: 'bg-green-500',
  hired: 'bg-emerald-600',
  rejected: 'bg-red-500',
  withdrawn: 'bg-gray-500'
};

function MetricCard({ 
  icon: Icon, 
  title, 
  value, 
  subtitle,
  testId 
}: { 
  icon: any; 
  title: string; 
  value: string | number; 
  subtitle?: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBar({ status, count, total }: { status: string; count: number; total: number }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const colorClass = STATUS_COLORS[status] || 'bg-gray-400';
  
  return (
    <div className="flex items-center gap-3" data-testid={`status-bar-${status}`}>
      <span className="w-24 text-sm capitalize">{status}</span>
      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-12 text-sm text-right font-medium">{count}</span>
    </div>
  );
}

function ShareLinkButton({ link }: { link: ShareLink }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast({ title: 'Link copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border" data-testid={`share-link-${link.label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{link.label}</p>
        <p className="text-xs text-muted-foreground truncate">{link.url}</p>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={handleCopy}
          data-testid={`copy-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => window.open(link.url, '_blank')}
          data-testid={`open-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function HiringPulsePage() {
  const [range, setRange] = useState<'7d' | '30d'>('7d');
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<HiringPulseResponse>({
    queryKey: ['/api/p2/app/mod/hiring-pulse', range],
    queryFn: async () => {
      const res = await fetch(`/api/p2/app/mod/jobs/hiring-pulse?range=${range}`);
      if (!res.ok) throw new Error('Failed to fetch hiring pulse data');
      return res.json();
    }
  });

  if (error) {
    return (
      <div className="p-6" data-testid="page-hiring-pulse-error">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load hiring pulse data. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const metrics = data?.metrics;
  const totalApplications = metrics?.newApplicationsCount || 0;
  const statusEntries = Object.entries(metrics?.applicationsByStatus || {});

  return (
    <div className="p-6 space-y-6" data-testid="page-hiring-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Hiring Pulse</h1>
            {data?.portalName && (
              <p className="text-muted-foreground">{data.portalName}</p>
            )}
          </div>
        </div>
        
        <Tabs value={range} onValueChange={(v) => setRange(v as '7d' | '30d')}>
          <TabsList>
            <TabsTrigger value="7d" data-testid="range-7d">Last 7 days</TabsTrigger>
            <TabsTrigger value="30d" data-testid="range-30d">Last 30 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={Users}
              title="New Applications"
              value={metrics?.newApplicationsCount || 0}
              subtitle={`in ${range === '7d' ? '7 days' : '30 days'}`}
              testId="metric-new-applications"
            />
            <MetricCard
              icon={Clock}
              title="Median Response Time"
              value={metrics?.medianFirstResponseMinutes != null 
                ? `${metrics?.medianFirstResponseMinutes}m`
                : 'N/A'}
              subtitle="first response"
              testId="metric-response-time"
            />
            <MetricCard
              icon={Home}
              title="Housing Needed"
              value={metrics?.housingNeededCount || 0}
              subtitle="applicants"
              testId="metric-housing-needed"
            />
            <MetricCard
              icon={FileCheck}
              title="Work Permit Questions"
              value={metrics?.workPermitQuestionsCount || 0}
              subtitle="applicants"
              testId="metric-work-permit"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-status-breakdown">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Conversion by Stage
                </CardTitle>
                <CardDescription>Application status breakdown</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statusEntries.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No applications in this period</p>
                ) : (
                  statusEntries.map(([status, count]) => (
                    <StatusBar 
                      key={status} 
                      status={status} 
                      count={count} 
                      total={totalApplications} 
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-top-employers">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Top Employers
                </CardTitle>
                <CardDescription>By application volume</CardDescription>
              </CardHeader>
              <CardContent>
                {!metrics?.topEmployersByApplications?.length ? (
                  <p className="text-muted-foreground text-sm">No employers with applications</p>
                ) : (
                  <div className="space-y-3">
                    {metrics.topEmployersByApplications.map((employer, idx) => (
                      <div 
                        key={employer.tenantId} 
                        className="flex items-center justify-between"
                        data-testid={`employer-${idx}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                            {idx + 1}
                          </Badge>
                          <span className="font-medium">{employer.tenantName}</span>
                        </div>
                        <Badge>{employer.applicationCount}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-share-links">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Share Links
              </CardTitle>
              <CardDescription>Copy links to share your job board and campaigns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!data?.shareLinks?.length ? (
                <p className="text-muted-foreground text-sm">No share links available</p>
              ) : (
                data.shareLinks.map((link) => (
                  <ShareLinkButton key={link.url} link={link} />
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
