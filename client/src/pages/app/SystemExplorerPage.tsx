import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Database, 
  Plug, 
  Activity, 
  Table2, 
  Route, 
  Check, 
  X, 
  AlertCircle,
  RefreshCw,
  Loader2,
  Shield,
  Clock,
  ShieldAlert,
  Globe
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';

interface OverviewData {
  tenantId: string | null;
  counts: Record<string, number | null>;
  integrations: Array<{
    name: string;
    envKey: string;
    category: string;
    configured: boolean;
  }>;
  pipelines: Array<{
    name: string;
    table: string;
    jsonPath?: string;
    category: string;
    exists: boolean;
    count: number;
    lastUpdated: string | null;
  }>;
  routesAudit: Array<{
    path: string;
    label: string;
    required: boolean;
    inNav: boolean;
    status: string;
  }>;
  allowedTables: Array<{
    name: string;
    label: string;
    tenantScoped: boolean;
  }>;
}

interface TableData {
  table: string;
  tenantScoped: boolean;
  tenantFiltered: boolean;
  rows: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface EvidenceItem {
  id: string;
  artifact_type: string;
  artifact_name: string;
  evidence_type: string;
  reference: string;
  owner_type: string | null;
  is_required: boolean;
  verification_status: string;
  last_verified_at: string | null;
  description: string | null;
  is_stale: boolean;
}

interface EvidenceData {
  evidence: EvidenceItem[];
  summary: {
    total: number;
    verified: number;
    missing: number;
    stale: number;
    unknown: number;
  };
}

interface VerifyResult {
  results: Array<{
    id: string;
    artifact_name: string;
    artifact_type: string;
    status: string;
    details?: string;
    checked_at: string;
    is_required: boolean;
  }>;
  summary: {
    total: number;
    verified: number;
    missing: number;
    errors: number;
    stale: number;
    allRequiredPassing: boolean;
  };
}

export default function SystemExplorerPage() {
  const { currentTenant, impersonation, user } = useTenant();
  const [selectedTable, setSelectedTable] = useState<string>('unified_assets');
  const [tablePage, setTablePage] = useState(1);
  const [activeTab, setActiveTab] = useState('overview');
  
  // SECURITY: Block access while impersonating
  if (impersonation?.is_impersonating) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center bg-background" data-testid="page-system-explorer-blocked">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Access Blocked
            </CardTitle>
            <CardDescription>
              System Explorer cannot be accessed while impersonating a tenant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exit impersonation to use System Explorer. This protects against accidental cross-tenant data exposure.
            </p>
            <Button 
              variant="default" 
              onClick={() => window.location.href = '/admin/impersonation'}
              data-testid="button-exit-impersonation"
            >
              <Shield className="h-4 w-4 mr-2" />
              Exit Impersonation
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useQuery<{ success: boolean; data: OverviewData }>({
    queryKey: ['/api/admin/system-explorer/overview'],
  });
  
  const { data: tableData, isLoading: tableLoading } = useQuery<{ success: boolean; data: TableData }>({
    queryKey: ['/api/admin/system-explorer/table', selectedTable, tablePage],
    enabled: !!selectedTable,
  });
  
  const { data: evidenceData, isLoading: evidenceLoading, refetch: refetchEvidence } = useQuery<{ success: boolean; data: EvidenceData }>({
    queryKey: ['/api/admin/system-explorer/evidence/status'],
  });
  
  const verifyMutation = useMutation<{ success: boolean; data: VerifyResult }>({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/system-explorer/evidence/verify');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/system-explorer/evidence/status'] });
    },
  });
  
  const overviewData = overview?.data;
  const tableResult = tableData?.data;
  const evidence = evidenceData?.data;

  // Helper to switch to Data Browser with a specific table
  const inspectTable = (tableName: string) => {
    setSelectedTable(tableName);
    setTablePage(1);
    setActiveTab('browser');
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen" data-testid="page-system-explorer">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">System Explorer</h1>
          <p className="text-muted-foreground text-sm">
            Discovery surface for debugging and testing. Read-only.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Platform Admin Context Badge */}
          <Badge variant="outline" className="border-purple-500 text-purple-500" data-testid="badge-context-mode">
            <Shield className="h-3 w-3 mr-1" />
            Mode: Platform Admin
          </Badge>
          <Badge variant="outline" data-testid="badge-context-scope">
            <Globe className="h-3 w-3 mr-1" />
            Scope: All Tenants
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetchOverview()}
            disabled={overviewLoading}
            data-testid="button-refresh"
          >
            {overviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 max-w-3xl">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Database className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="evidence" data-testid="tab-evidence">
            <Shield className="h-4 w-4 mr-2" />
            Evidence
          </TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">
            <Plug className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="pipelines" data-testid="tab-pipelines">
            <Activity className="h-4 w-4 mr-2" />
            Data Sources
          </TabsTrigger>
          <TabsTrigger value="browser" data-testid="tab-browser">
            <Table2 className="h-4 w-4 mr-2" />
            Data Browser
          </TabsTrigger>
          <TabsTrigger value="routes" data-testid="tab-routes">
            <Route className="h-4 w-4 mr-2" />
            Routes Audit
          </TabsTrigger>
        </TabsList>
        
        {/* Tab A: Overview */}
        <TabsContent value="overview" className="mt-6">
          {overviewLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {overviewData?.allowedTables.map((table) => {
                const count = overviewData.counts[table.name];
                
                return (
                  <Card key={table.name} data-testid={`card-entity-${table.name}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between gap-2">
                        {table.label}
                        {count === null ? (
                          <Badge variant="outline" className="text-xs">N/A</Badge>
                        ) : (
                          <Badge variant="secondary">{count}</Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono">
                        {table.name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => inspectTable(table.name)}
                        data-testid={`button-inspect-${table.name}`}
                      >
                        <Table2 className="h-3 w-3 mr-1" />
                        Inspect Data
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        
        {/* Tab B: Evidence Status */}
        <TabsContent value="evidence" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-base">Evidence Ledger</CardTitle>
                <CardDescription>
                  Track what should exist and verify it's accessible.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {evidence?.summary && (
                  <>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {evidence.summary.verified} verified
                    </Badge>
                    {evidence.summary.missing > 0 && (
                      <Badge variant="destructive">
                        {evidence.summary.missing} missing
                      </Badge>
                    )}
                    {evidence.summary.stale > 0 && (
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">
                        {evidence.summary.stale} stale
                      </Badge>
                    )}
                  </>
                )}
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={() => verifyMutation.mutate()}
                  disabled={verifyMutation.isPending}
                  data-testid="button-verify-all"
                >
                  {verifyMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Shield className="h-4 w-4 mr-2" />
                  )}
                  Verify All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {evidenceLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {evidence?.evidence.map((item) => {
                    const statusColor = 
                      item.verification_status === 'verified' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      item.verification_status === 'missing' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      item.is_stale ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                      'bg-gray-500/20 text-gray-400 border-gray-500/30';
                    
                    const statusIcon = 
                      item.verification_status === 'verified' ? <Check className="h-3 w-3 mr-1" /> :
                      item.verification_status === 'missing' ? <X className="h-3 w-3 mr-1" /> :
                      item.is_stale ? <Clock className="h-3 w-3 mr-1" /> :
                      <AlertCircle className="h-3 w-3 mr-1" />;
                    
                    return (
                      <div 
                        key={item.id}
                        className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-muted/30"
                        data-testid={`evidence-${item.artifact_type}-${item.artifact_name}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {item.artifact_type}
                          </Badge>
                          <span className="font-medium truncate">{item.artifact_name}</span>
                          <span className="text-xs text-muted-foreground font-mono truncate hidden md:inline">
                            {item.reference}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.is_required && (
                            <Badge variant="outline" className="text-xs">required</Badge>
                          )}
                          <Badge className={statusColor}>
                            {statusIcon}
                            {item.is_stale && item.verification_status !== 'missing' ? 'stale' : item.verification_status}
                          </Badge>
                          {item.last_verified_at && (
                            <span className="text-xs text-muted-foreground hidden lg:inline">
                              {new Date(item.last_verified_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab C: Integrations */}
        <TabsContent value="integrations" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overviewData?.integrations.map((int) => (
              <Card key={int.name} data-testid={`card-integration-${int.name.toLowerCase()}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    {int.name}
                    {int.configured ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <Check className="h-3 w-3 mr-1" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <X className="h-3 w-3 mr-1" />
                        Not Set
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Category: {int.category}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground font-mono">
                    Env: {int.envKey}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* Tab C: Data Sources / Pipelines */}
        <TabsContent value="pipelines" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overviewData?.pipelines.map((p) => (
              <Card key={p.name} data-testid={`card-pipeline-${p.name.toLowerCase().replace(/\s+/g, '-')}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    {p.name}
                    {p.exists ? (
                      <Badge variant="secondary">{p.count} locations</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        No Data
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {p.category}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-xs text-muted-foreground font-mono">
                    {p.table}.data.{p.jsonPath}
                  </p>
                  {p.lastUpdated && (
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(p.lastUpdated).toLocaleString()}
                    </p>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="mt-2"
                    onClick={() => inspectTable('snapshots')}
                    data-testid={`button-inspect-pipeline-${p.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Table2 className="h-3 w-3 mr-1" />
                    Inspect Snapshots
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* Tab D: Data Browser */}
        <TabsContent value="browser" className="mt-6 space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Select value={selectedTable} onValueChange={(v) => { setSelectedTable(v); setTablePage(1); }}>
              <SelectTrigger className="w-64" data-testid="select-table">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {overviewData?.allowedTables.map((t) => (
                  <SelectItem key={t.name} value={t.name}>
                    {t.label} ({t.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {tableResult && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  Page {tableResult.pagination.page} of {tableResult.pagination.pages} 
                  ({tableResult.pagination.total} total)
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={tablePage <= 1}
                  onClick={() => setTablePage(p => p - 1)}
                  data-testid="button-prev-page"
                >
                  Prev
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={tablePage >= tableResult.pagination.pages}
                  onClick={() => setTablePage(p => p + 1)}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
          
          {tableLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tableResult?.rows.length === 0 ? (
            <Card data-testid="card-empty-state">
              <CardHeader>
                <CardTitle className="text-base">
                  {overviewData?.allowedTables.find(t => t.name === selectedTable)?.label || selectedTable}
                </CardTitle>
                <CardDescription>
                  Table: <span className="font-mono">{selectedTable}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground mb-4" data-testid="text-empty-state">
                  No data in this table{tableResult?.tenantScoped ? ' (tenant-scoped - requires tenant context)' : ''}.
                </p>
                <Badge variant="outline" data-testid="badge-row-count">0 rows</Badge>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-md overflow-auto max-h-[600px]">
              <table className="w-full text-sm" data-testid="table-data-browser">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {tableResult?.rows[0] && Object.keys(tableResult.rows[0]).map((key) => (
                      <th key={key} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableResult?.rows.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-muted/30">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-2 whitespace-nowrap max-w-[300px] truncate">
                          {val === null ? (
                            <span className="text-muted-foreground italic">null</span>
                          ) : typeof val === 'object' ? (
                            <span className="font-mono text-xs">{JSON.stringify(val).slice(0, 100)}</span>
                          ) : (
                            String(val).slice(0, 100)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
        
        {/* Tab E: Routes Audit */}
        <TabsContent value="routes" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Key Routes Audit</CardTitle>
              <CardDescription>
                Verifies that critical routes are present in navigation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overviewData?.routesAudit.map((r) => (
                  <div 
                    key={r.path} 
                    className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-muted/30"
                    data-testid={`route-audit-${r.path.replace(/\//g, '-')}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">{r.path}</span>
                      <span className="text-sm text-muted-foreground">{r.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.inNav ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          <Check className="h-3 w-3 mr-1" />
                          In Nav
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <X className="h-3 w-3 mr-1" />
                          Missing
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
                        {r.required ? 'required' : 'optional'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
