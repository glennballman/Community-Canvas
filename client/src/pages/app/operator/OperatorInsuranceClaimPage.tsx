/**
 * OperatorInsuranceClaimPage - Insurance claim detail with tabs
 * Route: /app/operator/insurance/claims/:claimId
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Shield, FileArchive, Share2 } from 'lucide-react';
import { OperatorActionPanel } from '@/components/operator/OperatorActionPanel';
import { OperatorResultLinks } from '@/components/operator/OperatorResultLinks';
import { OperatorAuditFeed, type AuditEvent } from '@/components/operator/OperatorAuditFeed';
import { AuthoritySharePreviewCard, AuthorityGrantDetailsCard, calculateExpiresAt } from '@/components/operator/authority';
import { useAssembleInsuranceDossier } from '@/lib/api/operatorP2/useAssembleInsuranceDossier';
import { useExportInsuranceDossier } from '@/lib/api/operatorP2/useExportInsuranceDossier';
import { useShareInsuranceDossierAuthority } from '@/lib/api/operatorP2/useShareInsuranceDossierAuthority';
import { useOperatorAuditEvents } from '@/lib/api/operatorP2/useOperatorAuditEvents';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';

function AuditFeedWithFilter({ filterId }: { filterId: string }) {
  const { data: events, isLoading } = useOperatorAuditEvents(200);
  
  const filtered = useMemo(() => {
    if (!events) return [];
    return events.filter((e: AuditEvent) => 
      e.subject_id === filterId || 
      JSON.stringify(e.payload || {}).includes(filterId)
    ).slice(0, 50);
  }, [events, filterId]);
  
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return <OperatorAuditFeed items={filtered} />;
}

export default function OperatorInsuranceClaimPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const assembleDossier = useAssembleInsuranceDossier();
  const exportDossier = useExportInsuranceDossier();
  const shareAuthority = useShareInsuranceDossierAuthority();
  
  const [versionLabel, setVersionLabel] = useState('');
  const [assembledDossierId, setAssembledDossierId] = useState('');
  const [exportDossierId, setExportDossierId] = useState('');
  const [shareDossierId, setShareDossierId] = useState('');
  const [exportResult, setExportResult] = useState<{ r2Key?: string; url?: string } | null>(null);
  const [shareResult, setShareResult] = useState<{ grantId?: string; accessUrl?: string } | null>(null);
  const [shareScope, setShareScope] = useState('dossier_only');
  const [shareExpiry, setShareExpiry] = useState('none');
  const [broadScopeAck, setBroadScopeAck] = useState(false);
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator-insurance-claim');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  useEffect(() => {
    if (assembledDossierId) {
      setExportDossierId(assembledDossierId);
      setShareDossierId(assembledDossierId);
    }
  }, [assembledDossierId]);
  
  if (!claimId) {
    return <div className="p-6">Claim ID required</div>;
  }
  
  const handleAssembleDossier = async () => {
    const result = await assembleDossier.mutateAsync({
      claimId,
      versionLabel: versionLabel || undefined,
    });
    setAssembledDossierId(result.dossierId);
    return result;
  };
  
  const handleExportDossier = async () => {
    const result = await exportDossier.mutateAsync({
      dossierId: exportDossierId.trim(),
      format: 'zip_json',
    });
    setExportResult({ r2Key: result.r2Key, url: result.url });
    return result;
  };
  
  const handleShareAuthority = async () => {
    const result = await shareAuthority.mutateAsync({
      dossierId: shareDossierId.trim(),
    });
    setShareResult({ grantId: result.grantId, accessUrl: result.accessUrl });
    return result;
  };
  
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/app/operator/insurance">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-6 w-6" />
            Insurance Claim
          </h1>
          <p className="text-muted-foreground text-sm font-mono">{claimId}</p>
        </div>
      </div>
      
      <Tabs defaultValue="dossier" className="space-y-4">
        <TabsList data-testid="tabs-claim-detail">
          <TabsTrigger value="dossier" data-testid="tab-dossier">Dossier</TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export">Export</TabsTrigger>
          <TabsTrigger value="share" data-testid="tab-share">Share</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dossier" className="space-y-4">
          <OperatorActionPanel
            title="Assemble Dossier"
            description="Compile claim evidence into a verifiable dossier"
            actionLabel="Assemble Dossier"
            onAction={handleAssembleDossier}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Version Label (optional)</label>
              <Input
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="e.g., v1.0, initial-review"
                data-testid="input-version-label"
              />
            </div>
          </OperatorActionPanel>
          
          {assembledDossierId && (
            <OperatorResultLinks
              title="Dossier Assembled"
              links={[
                {
                  label: 'Dossier ID',
                  id: assembledDossierId,
                  path: `/app/operator/insurance/claims/${claimId}`,
                  type: 'dossierId',
                },
              ]}
            />
          )}
        </TabsContent>
        
        <TabsContent value="export" className="space-y-4">
          <OperatorActionPanel
            title="Export Dossier"
            description="Export dossier as a zip package"
            actionLabel="Export"
            onAction={handleExportDossier}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Dossier ID</label>
              <Input
                value={exportDossierId}
                onChange={(e) => setExportDossierId(e.target.value)}
                placeholder="Enter dossier UUID"
                data-testid="input-export-dossier-id"
              />
            </div>
          </OperatorActionPanel>
          
          {exportResult && (
            <Card data-testid="card-export-result">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileArchive className="h-4 w-4" />
                  Export Complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {exportResult.r2Key && (
                  <div>
                    <span className="text-muted-foreground">R2 Key: </span>
                    <span className="font-mono">{exportResult.r2Key}</span>
                  </div>
                )}
                {exportResult.url && (
                  <div>
                    <span className="text-muted-foreground">URL: </span>
                    <a href={exportResult.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      Download
                    </a>
                  </div>
                )}
                {!exportResult.r2Key && !exportResult.url && (
                  <p className="text-muted-foreground">Export completed successfully</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="share" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <AuthoritySharePreviewCard
                subjectType="insurance_dossier"
                subjectId={shareDossierId || claimId}
                defaultScope="dossier_only"
                onScopeChange={setShareScope}
                onExpiryChange={setShareExpiry}
                onBroadScopeAcknowledge={setBroadScopeAck}
                meta={{ title: 'Insurance Dossier' }}
              />
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Dossier ID</label>
                <Input
                  value={shareDossierId}
                  onChange={(e) => setShareDossierId(e.target.value)}
                  placeholder="Enter dossier UUID"
                  data-testid="input-share-dossier-id"
                />
                <p className="text-xs text-muted-foreground">
                  Use the dossier ID from an assembled dossier
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <OperatorActionPanel
                title="Share with Authority"
                description="Generate secure access for external adjusters"
                actionLabel="Share Access"
                disabled={(shareScope === 'all_related' && !broadScopeAck) || !shareDossierId.trim()}
                onAction={async () => {
                  const result = await shareAuthority.mutateAsync({
                    dossierId: shareDossierId.trim(),
                    scope: shareScope,
                    expiresAt: calculateExpiresAt(shareExpiry),
                  });
                  setShareResult({ grantId: result.grantId, accessUrl: result.accessUrl });
                  return result;
                }}
                resultRenderer={(result) => {
                  const r = result as { grantId: string };
                  return <span>Grant created: <code>{r.grantId}</code></span>;
                }}
              >
                <p className="text-sm text-muted-foreground">
                  Scope and expiry are configured in the preview panel
                </p>
              </OperatorActionPanel>
              
              {shareResult && (
                <AuthorityGrantDetailsCard
                  grantId={shareResult.grantId}
                  accessUrl={shareResult.accessUrl}
                  status="active"
                  scopeSummary={shareScope}
                />
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="audit" className="space-y-4">
          <AuditFeedWithFilter filterId={claimId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
