/**
 * OperatorEmergencyRunPage - Individual emergency run management
 * Route: /app/operator/emergency/:runId
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, ArrowLeft, CheckCircle, Download, Users } from 'lucide-react';
import { OperatorActionPanel } from '@/components/operator/OperatorActionPanel';
import { OperatorAuditFeed } from '@/components/operator/OperatorAuditFeed';
import { AuthoritySharePreviewCard, AuthorityGrantDetailsCard, calculateExpiresAt } from '@/components/operator/authority';
import { useResolveEmergencyRun } from '@/lib/api/operatorP2/useResolveEmergencyRun';
import { useGrantEmergencyScope } from '@/lib/api/operatorP2/useGrantEmergencyScope';
import { useRevokeEmergencyScope } from '@/lib/api/operatorP2/useRevokeEmergencyScope';
import { useExportEmergencyPlaybook } from '@/lib/api/operatorP2/useExportEmergencyPlaybook';
import { useGenerateEmergencyRecordPack } from '@/lib/api/operatorP2/useGenerateEmergencyRecordPack';
import { useShareEmergencyAuthority } from '@/lib/api/operatorP2/useShareEmergencyAuthority';
import { useOperatorAuditEvents } from '@/lib/api/operatorP2/useOperatorAuditEvents';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';

const GRANT_TYPES = [
  { value: 'asset_control', label: 'Asset Control' },
  { value: 'tool_access', label: 'Tool Access' },
  { value: 'vehicle_access', label: 'Vehicle Access' },
  { value: 'lodging_access', label: 'Lodging Access' },
  { value: 'communications_interrupt', label: 'Communications Interrupt' },
  { value: 'procurement_override', label: 'Procurement Override' },
  { value: 'gate_access', label: 'Gate Access' },
  { value: 'other', label: 'Other' },
];

export default function OperatorEmergencyRunPage() {
  const { runId } = useParams<{ runId: string }>();
  
  const resolveRun = useResolveEmergencyRun();
  const grantScope = useGrantEmergencyScope();
  const revokeScope = useRevokeEmergencyScope();
  const exportPlaybook = useExportEmergencyPlaybook();
  const generateRecordPack = useGenerateEmergencyRecordPack();
  const shareAuthority = useShareEmergencyAuthority();
  const auditQuery = useOperatorAuditEvents(50);
  
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [granteeId, setGranteeId] = useState('');
  const [grantType, setGrantType] = useState('other');
  const [expiresAt, setExpiresAt] = useState('');
  const [scopeJson, setScopeJson] = useState('{}');
  const [revokeGrantId, setRevokeGrantId] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const [recordPackTitle, setRecordPackTitle] = useState('');
  const [authorityEmail, setAuthorityEmail] = useState('');
  const [shareScope, setShareScope] = useState('run_only');
  const [shareExpiry, setShareExpiry] = useState('none');
  const [broadScopeAck, setBroadScopeAck] = useState(false);
  const [lastShareResult, setLastShareResult] = useState<{ grantId?: string; token?: string; accessUrl?: string } | null>(null);
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator-emergency-run');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  if (!runId) {
    return <div className="p-6">Run ID not found</div>;
  }
  
  const filteredAuditEvents = (auditQuery.data || []).filter(
    (event) => event.subject_id === runId
  );
  
  return (
    <div className="p-6 space-y-6" data-testid="page-operator-emergency-run">
      <div className="flex items-center gap-4">
        <Link to="/app/operator/emergency">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold">Emergency Run</h1>
            <p className="text-muted-foreground text-sm font-mono">{runId}</p>
          </div>
        </div>
        <Badge variant="outline" className="ml-auto">Active</Badge>
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList data-testid="tabs-run">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="scope" data-testid="tab-scope">Scope Grants</TabsTrigger>
          <TabsTrigger value="share" data-testid="tab-share">Share</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <OperatorActionPanel
              title="Resolve Run"
              description="Mark this emergency run as resolved"
              actionLabel="Resolve"
              onAction={async () => {
                const result = await resolveRun.mutateAsync({
                  runId,
                  resolution_notes: resolutionNotes || undefined,
                });
                return result;
              }}
              resultRenderer={() => (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Run resolved successfully
                </span>
              )}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution Notes (optional)</label>
                <Textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Summary of resolution..."
                  rows={3}
                  data-testid="textarea-resolution-notes"
                />
              </div>
            </OperatorActionPanel>
            
            <OperatorActionPanel
              title="Generate Record Pack"
              description="Create an evidence bundle from this run"
              actionLabel="Generate"
              onAction={async () => {
                const result = await generateRecordPack.mutateAsync({
                  runId,
                  title: recordPackTitle || undefined,
                  sealBundle: true,
                });
                return result;
              }}
              resultRenderer={(result) => {
                const r = result as { packId: string };
                return <span>Pack created: <code>{r.packId}</code></span>;
              }}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium">Pack Title (optional)</label>
                <Input
                  value={recordPackTitle}
                  onChange={(e) => setRecordPackTitle(e.target.value)}
                  placeholder="Evidence bundle title"
                  data-testid="input-record-pack-title"
                />
              </div>
            </OperatorActionPanel>
            
            <OperatorActionPanel
              title="Export Playbook"
              description="Export run data as ZIP archive"
              actionLabel="Export"
              onAction={async () => {
                const result = await exportPlaybook.mutateAsync({
                  runId,
                  format: 'zip_json',
                });
                return result;
              }}
              resultRenderer={() => (
                <span className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Playbook exported
                </span>
              )}
            >
              <p className="text-sm text-muted-foreground">
                Export format: ZIP with JSON data
              </p>
            </OperatorActionPanel>
            
          </div>
        </TabsContent>
        
        <TabsContent value="scope" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <OperatorActionPanel
              title="Grant Scope"
              description="Grant emergency access to an individual"
              actionLabel="Grant Access"
              onAction={async () => {
                const result = await grantScope.mutateAsync({
                  runId,
                  grantee_individual_id: granteeId,
                  grant_type: grantType,
                  scope_json: scopeJson || undefined,
                  expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
                });
                return result;
              }}
              resultRenderer={(result) => {
                const r = result as { grantId?: string; granted: boolean };
                return (
                  <span className="flex items-center gap-2 text-green-600">
                    <Users className="h-4 w-4" />
                    Access granted{r.grantId ? `: ${r.grantId}` : ''}
                  </span>
                );
              }}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Grantee Individual ID *</label>
                  <Input
                    value={granteeId}
                    onChange={(e) => setGranteeId(e.target.value)}
                    placeholder="Individual UUID"
                    data-testid="input-grantee-id"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Grant Type</label>
                  <Select value={grantType} onValueChange={setGrantType}>
                    <SelectTrigger data-testid="select-grant-type">
                      <SelectValue placeholder="Select grant type" />
                    </SelectTrigger>
                    <SelectContent>
                      {GRANT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Expires At (optional)</label>
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    data-testid="input-expires-at"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Scope JSON (optional)</label>
                  <Textarea
                    value={scopeJson}
                    onChange={(e) => setScopeJson(e.target.value)}
                    placeholder='{"assets": ["*"]}'
                    rows={2}
                    className="font-mono text-sm"
                    data-testid="textarea-scope-json"
                  />
                </div>
              </div>
            </OperatorActionPanel>
            
            <OperatorActionPanel
              title="Revoke Scope"
              description="Remove a previously granted scope"
              actionLabel="Revoke Access"
              onAction={async () => {
                const result = await revokeScope.mutateAsync({
                  runId,
                  grant_id: revokeGrantId,
                  reason: revokeReason || undefined,
                });
                return result;
              }}
              resultRenderer={() => (
                <span className="text-amber-600">Access revoked</span>
              )}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Grant ID *</label>
                  <Input
                    value={revokeGrantId}
                    onChange={(e) => setRevokeGrantId(e.target.value)}
                    placeholder="Grant UUID to revoke"
                    data-testid="input-revoke-grant-id"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason (optional)</label>
                  <Input
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    placeholder="Reason for revocation"
                    data-testid="input-revoke-reason"
                  />
                </div>
              </div>
            </OperatorActionPanel>
          </div>
        </TabsContent>
        
        <TabsContent value="share" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <AuthoritySharePreviewCard
              subjectType="emergency_run"
              subjectId={runId}
              defaultScope="run_only"
              onScopeChange={setShareScope}
              onExpiryChange={setShareExpiry}
              onBroadScopeAcknowledge={setBroadScopeAck}
              meta={{ title: 'Emergency Run' }}
            />
            
            <div className="space-y-6">
              <OperatorActionPanel
                title="Share with Authority"
                description="Create read-only access for external parties"
                actionLabel="Share Access"
                disabled={shareScope === 'all_related' && !broadScopeAck}
                onAction={async () => {
                  const scopeMap: Record<string, 'run' | 'record_pack' | 'all'> = {
                    'run_only': 'run',
                    'record_pack_only': 'record_pack',
                    'run_and_record_pack': 'all',
                    'all_related': 'all',
                  };
                  const result = await shareAuthority.mutateAsync({
                    runId,
                    authority_email: authorityEmail || undefined,
                    scope: scopeMap[shareScope] || 'run',
                    expires_at: calculateExpiresAt(shareExpiry),
                  });
                  setLastShareResult(result);
                  return result;
                }}
                resultRenderer={(result) => {
                  const r = result as { grantId: string; token: string };
                  return <span>Grant created: <code>{r.grantId}</code></span>;
                }}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">Authority Email (optional)</label>
                  <Input
                    type="email"
                    value={authorityEmail}
                    onChange={(e) => setAuthorityEmail(e.target.value)}
                    placeholder="authority@example.gov"
                    data-testid="input-authority-email"
                  />
                </div>
              </OperatorActionPanel>
              
              {lastShareResult && (
                <AuthorityGrantDetailsCard
                  grantId={lastShareResult.grantId}
                  accessUrl={lastShareResult.accessUrl}
                  status="active"
                  scopeSummary={shareScope}
                />
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit Events for this Run</CardTitle>
              <CardDescription>
                {filteredAuditEvents.length} events (filtered by run ID)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditQuery.isLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <OperatorAuditFeed items={filteredAuditEvents} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
