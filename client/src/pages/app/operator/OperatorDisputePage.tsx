/**
 * OperatorDisputePage - Dispute detail with tabs
 * Route: /app/operator/disputes/:disputeId
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Swords, FileArchive, Share2 } from 'lucide-react';
import { OperatorActionPanel } from '@/components/operator/OperatorActionPanel';
import { OperatorResultLinks } from '@/components/operator/OperatorResultLinks';
import { OperatorAuditFeed, type AuditEvent } from '@/components/operator/OperatorAuditFeed';
import { useAssembleDefensePack } from '@/lib/api/operatorP2/useAssembleDefensePack';
import { useExportDefensePack } from '@/lib/api/operatorP2/useExportDefensePack';
import { useShareDefensePackAuthority } from '@/lib/api/operatorP2/useShareDefensePackAuthority';
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

export default function OperatorDisputePage() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const assembleDefensePack = useAssembleDefensePack();
  const exportDefensePack = useExportDefensePack();
  const shareAuthority = useShareDefensePackAuthority();
  
  const [versionLabel, setVersionLabel] = useState('');
  const [assembledDefensePackId, setAssembledDefensePackId] = useState('');
  const [exportDefensePackId, setExportDefensePackId] = useState('');
  const [shareDefensePackId, setShareDefensePackId] = useState('');
  const [exportResult, setExportResult] = useState<{ r2Key?: string; url?: string } | null>(null);
  const [shareResult, setShareResult] = useState<{ grantId?: string; accessUrl?: string } | null>(null);
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator-dispute');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  useEffect(() => {
    if (assembledDefensePackId) {
      setExportDefensePackId(assembledDefensePackId);
      setShareDefensePackId(assembledDefensePackId);
    }
  }, [assembledDefensePackId]);
  
  if (!disputeId) {
    return <div className="p-6">Dispute ID required</div>;
  }
  
  const handleAssembleDefensePack = async () => {
    const result = await assembleDefensePack.mutateAsync({
      disputeId,
      versionLabel: versionLabel || undefined,
    });
    setAssembledDefensePackId(result.defensePackId);
    return result;
  };
  
  const handleExportDefensePack = async () => {
    const result = await exportDefensePack.mutateAsync({
      defensePackId: exportDefensePackId.trim(),
      format: 'zip_json',
    });
    setExportResult({ r2Key: result.r2Key, url: result.url });
    return result;
  };
  
  const handleShareAuthority = async () => {
    const result = await shareAuthority.mutateAsync({
      defensePackId: shareDefensePackId.trim(),
    });
    setShareResult({ grantId: result.grantId, accessUrl: result.accessUrl });
    return result;
  };
  
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/app/operator/disputes">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Swords className="h-6 w-6" />
            Dispute
          </h1>
          <p className="text-muted-foreground text-sm font-mono">{disputeId}</p>
        </div>
      </div>
      
      <Tabs defaultValue="defense" className="space-y-4">
        <TabsList data-testid="tabs-dispute-detail">
          <TabsTrigger value="defense" data-testid="tab-defense">Defense Pack</TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export">Export</TabsTrigger>
          <TabsTrigger value="share" data-testid="tab-share">Share</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit</TabsTrigger>
        </TabsList>
        
        <TabsContent value="defense" className="space-y-4">
          <OperatorActionPanel
            title="Assemble Defense Pack"
            description="Compile dispute evidence into a defense package"
            actionLabel="Assemble Defense Pack"
            onAction={handleAssembleDefensePack}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Version Label (optional)</label>
              <Input
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="e.g., v1.0, initial-defense"
                data-testid="input-version-label"
              />
            </div>
          </OperatorActionPanel>
          
          {assembledDefensePackId && (
            <OperatorResultLinks
              title="Defense Pack Assembled"
              links={[
                {
                  label: 'Defense Pack ID',
                  id: assembledDefensePackId,
                  path: `/app/operator/disputes/${disputeId}`,
                  type: 'defensePackId',
                },
              ]}
            />
          )}
        </TabsContent>
        
        <TabsContent value="export" className="space-y-4">
          <OperatorActionPanel
            title="Export Defense Pack"
            description="Export defense pack as a zip package"
            actionLabel="Export"
            onAction={handleExportDefensePack}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Defense Pack ID</label>
              <Input
                value={exportDefensePackId}
                onChange={(e) => setExportDefensePackId(e.target.value)}
                placeholder="Enter defense pack UUID"
                data-testid="input-export-defense-pack-id"
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
          <OperatorActionPanel
            title="Share with Authority"
            description="Generate secure access for legal representatives"
            actionLabel="Share Authority"
            onAction={handleShareAuthority}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Defense Pack ID</label>
              <Input
                value={shareDefensePackId}
                onChange={(e) => setShareDefensePackId(e.target.value)}
                placeholder="Enter defense pack UUID"
                data-testid="input-share-defense-pack-id"
              />
            </div>
          </OperatorActionPanel>
          
          {shareResult && (
            <Card data-testid="card-share-result">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Authority Granted
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {shareResult.grantId && (
                  <div>
                    <span className="text-muted-foreground">Grant ID: </span>
                    <span className="font-mono">{shareResult.grantId}</span>
                  </div>
                )}
                {shareResult.accessUrl && (
                  <div>
                    <span className="text-muted-foreground">Access URL: </span>
                    <a href={shareResult.accessUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">
                      {shareResult.accessUrl}
                    </a>
                  </div>
                )}
                {!shareResult.grantId && !shareResult.accessUrl && (
                  <p className="text-muted-foreground">Authority granted successfully</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="audit" className="space-y-4">
          <AuditFeedWithFilter filterId={disputeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
