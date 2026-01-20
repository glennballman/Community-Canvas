/**
 * Platform Analytics Page - P-UI-17
 * Route: /app/platform/analytics
 * 
 * Platform-wide analytics dashboard with certification status
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, Users, Building2, Globe, TrendingUp, CheckCircle2, 
  XCircle, Clock, FileCheck, AlertTriangle 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PlatformStats {
  total_tenants: string;
  active_tenants: string;
  total_portals: string;
  active_portals: string;
  total_users: string;
  active_users: string;
  platform_admins: string;
  total_memberships: string;
  government_tenants: string;
  business_tenants: string;
  property_tenants: string;
  individual_tenants: string;
}

interface RecentStats {
  new_tenants_7d: string;
  new_users_7d: string;
  new_portals_7d: string;
}

interface GrowthMetrics {
  portals_with_jobs: string;
  new_jobs_7d: string;
  new_applications_7d: string;
}

interface AnalyticsResponse {
  success: boolean;
  analytics: {
    platform: PlatformStats;
    recent: RecentStats;
    growth: GrowthMetrics | null;
    generatedAt: string;
  };
}

interface CertCheck {
  passed: boolean;
  violationCount?: number;
  checks?: Array<{ name: string; passed: boolean }>;
}

interface CertStatus {
  version: string;
  lastRun: string | null;
  status: 'passed' | 'failed';
  proofPath: string;
  checks: {
    terminology: CertCheck;
    invariants: CertCheck | null;
    routes: {
      api: { count: number } | null;
      ui: { count: number } | null;
    };
  };
}

interface CertResponse {
  success: boolean;
  cert: CertStatus;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export default function AnalyticsPage() {
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<AnalyticsResponse>({
    queryKey: ['/api/p2/platform/analytics/summary'],
    queryFn: async () => {
      const res = await fetch('/api/p2/platform/analytics/summary', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    },
  });

  const { data: certData, isLoading: certLoading } = useQuery<CertResponse>({
    queryKey: ['/api/p2/platform/cert/status'],
    queryFn: async () => {
      const res = await fetch('/api/p2/platform/cert/status', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch cert status');
      return res.json();
    },
  });

  const platform = analyticsData?.analytics?.platform;
  const recent = analyticsData?.analytics?.recent;
  const growth = analyticsData?.analytics?.growth;
  const cert = certData?.cert;

  const statCards = [
    { label: 'Total Tenants', value: platform?.total_tenants, icon: Building2, color: 'text-blue-600' },
    { label: 'Active Tenants', value: platform?.active_tenants, icon: Building2, color: 'text-green-600' },
    { label: 'Total Portals', value: platform?.total_portals, icon: Globe, color: 'text-purple-600' },
    { label: 'Active Portals', value: platform?.active_portals, icon: Globe, color: 'text-green-600' },
    { label: 'Total Users', value: platform?.total_users, icon: Users, color: 'text-blue-600' },
    { label: 'Active Users', value: platform?.active_users, icon: Users, color: 'text-green-600' },
    { label: 'Platform Admins', value: platform?.platform_admins, icon: Users, color: 'text-red-600' },
    { label: 'Total Memberships', value: platform?.total_memberships, icon: Users, color: 'text-gray-600' },
  ];

  const tenantsByType = [
    { type: 'Government', count: platform?.government_tenants || '0', color: 'bg-blue-500' },
    { type: 'Business', count: platform?.business_tenants || '0', color: 'bg-green-500' },
    { type: 'Property', count: platform?.property_tenants || '0', color: 'bg-purple-500' },
    { type: 'Individual', count: platform?.individual_tenants || '0', color: 'bg-gray-500' },
  ];

  return (
    <div className="p-6 space-y-6" data-testid="page-platform-analytics">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground">Platform-wide metrics and certification status</p>
        </div>
      </div>

      {analyticsLoading ? (
        <div className="text-center py-8 text-muted-foreground" data-testid="text-loading">Loading analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4" data-testid="analytics-stats-grid">
            {statCards.map((stat, i) => (
              <Card key={i} data-testid={`stat-card-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold" data-testid={`stat-value-${i}`}>{stat.value ?? '-'}</div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  7-Day Activity
                </CardTitle>
                <CardDescription>Recent growth metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4" data-testid="activity-content">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid="activity-row-tenants">
                  <span className="text-sm">New Tenants</span>
                  <Badge variant="secondary" data-testid="badge-new-tenants">{recent?.new_tenants_7d ?? '-'}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid="activity-row-users">
                  <span className="text-sm">New Users</span>
                  <Badge variant="secondary" data-testid="badge-new-users">{recent?.new_users_7d ?? '-'}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid="activity-row-portals">
                  <span className="text-sm">New Portals</span>
                  <Badge variant="secondary" data-testid="badge-new-portals">{recent?.new_portals_7d ?? '-'}</Badge>
                </div>
                {growth && (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid="activity-row-jobs">
                      <span className="text-sm">New Jobs</span>
                      <Badge variant="secondary" data-testid="badge-new-jobs">{growth.new_jobs_7d ?? '-'}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid="activity-row-applications">
                      <span className="text-sm">New Applications</span>
                      <Badge variant="secondary" data-testid="badge-new-applications">{growth.new_applications_7d ?? '-'}</Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Tenants by Type
                </CardTitle>
                <CardDescription>Distribution across tenant types</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3" data-testid="tenant-types-content">
                {tenantsByType.map((item, i) => (
                  <div key={i} className="flex items-center gap-3" data-testid={`tenant-type-row-${item.type.toLowerCase()}`}>
                    <div className={`h-3 w-3 rounded-full ${item.color}`} />
                    <span className="flex-1 text-sm">{item.type}</span>
                    <span className="font-medium" data-testid={`tenant-type-count-${item.type.toLowerCase()}`}>{item.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card data-testid="card-certification">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  V3.5 Certification
                </CardTitle>
                <CardDescription>System certification status</CardDescription>
              </CardHeader>
              <CardContent>
                {certLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : cert ? (
                  <div className="space-y-4" data-testid="cert-content">
                    <div className="flex items-center justify-between p-4 rounded-lg border" data-testid="cert-status-row">
                      <div className="flex items-center gap-3">
                        {cert.status === 'passed' ? (
                          <CheckCircle2 className="h-6 w-6 text-green-600" />
                        ) : (
                          <XCircle className="h-6 w-6 text-red-600" />
                        )}
                        <div>
                          <div className="font-medium" data-testid="text-cert-version">{cert.version}</div>
                          <div className="text-sm text-muted-foreground" data-testid="text-cert-last-run">
                            {cert.lastRun 
                              ? `Last run ${formatDistanceToNow(new Date(cert.lastRun), { addSuffix: true })}`
                              : 'Never run'
                            }
                          </div>
                        </div>
                      </div>
                      <Badge variant={cert.status === 'passed' ? 'default' : 'destructive'} data-testid="badge-cert-status">
                        {cert.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="space-y-2" data-testid="cert-checks">
                      <div className="flex items-center justify-between p-2 rounded bg-muted/50" data-testid="check-terminology">
                        <div className="flex items-center gap-2">
                          {cert.checks.terminology?.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          )}
                          <span className="text-sm">Terminology Scan</span>
                        </div>
                        <span className="text-xs text-muted-foreground" data-testid="text-terminology-violations">
                          {cert.checks.terminology?.violationCount ?? 0} violations
                        </span>
                      </div>

                      {cert.checks.invariants && (
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50" data-testid="check-invariants">
                          <div className="flex items-center gap-2">
                            {cert.checks.invariants.passed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="text-sm">Invariants</span>
                          </div>
                          <span className="text-xs text-muted-foreground" data-testid="text-invariants-count">
                            {cert.checks.invariants.checks?.length ?? 0} checks
                          </span>
                        </div>
                      )}

                      {cert.checks.routes?.api && (
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50" data-testid="check-api-routes">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm">API Routes</span>
                          </div>
                          <span className="text-xs text-muted-foreground" data-testid="text-api-routes-count">
                            {cert.checks.routes.api.count} endpoints
                          </span>
                        </div>
                      )}

                      {cert.checks.routes?.ui && (
                        <div className="flex items-center justify-between p-2 rounded bg-muted/50" data-testid="check-ui-routes">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-sm">UI Routes</span>
                          </div>
                          <span className="text-xs text-muted-foreground" data-testid="text-ui-routes-count">
                            {cert.checks.routes.ui.count} pages
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-proof-path">
                      <Clock className="h-3 w-3" />
                      Proof path: {cert.proofPath}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    Certification data unavailable
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
