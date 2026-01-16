/**
 * OperatorLegalHoldDetailPage - Legal hold detail with tabs
 * Route: /app/operator/legal/:holdId
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Scale, Target, FileText, Check } from 'lucide-react';
import { OperatorActionPanel } from '@/components/operator/OperatorActionPanel';
import { OperatorAuditFeed, type AuditEvent } from '@/components/operator/OperatorAuditFeed';
import { useReleaseLegalHold } from '@/lib/api/operatorP2/useReleaseLegalHold';
import { useAddLegalHoldTarget, type LegalHoldTargetType } from '@/lib/api/operatorP2/useAddLegalHoldTarget';
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

const TARGET_TYPES: { value: LegalHoldTargetType; label: string }[] = [
  { value: 'evidence_object', label: 'Evidence Object' },
  { value: 'evidence_bundle', label: 'Evidence Bundle' },
  { value: 'emergency_run', label: 'Emergency Run' },
  { value: 'claim', label: 'Insurance Claim' },
  { value: 'dossier', label: 'Claim Dossier' },
  { value: 'defense_pack', label: 'Defense Pack' },
];

export default function OperatorLegalHoldDetailPage() {
  const { holdId } = useParams<{ holdId: string }>();
  const releaseLegalHold = useReleaseLegalHold();
  const addLegalHoldTarget = useAddLegalHoldTarget();
  
  const [releaseReason, setReleaseReason] = useState('');
  const [targetType, setTargetType] = useState<LegalHoldTargetType>('evidence_bundle');
  const [targetId, setTargetId] = useState('');
  const [targetNote, setTargetNote] = useState('');
  const [addedTargets, setAddedTargets] = useState<{ type: string; id: string }[]>([]);
  const [isReleased, setIsReleased] = useState(false);
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator-legal-detail');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  if (!holdId) {
    return <div className="p-6">Hold ID required</div>;
  }
  
  const handleReleaseHold = async () => {
    const result = await releaseLegalHold.mutateAsync({
      holdId,
      reason: releaseReason || undefined,
    });
    setIsReleased(true);
    return result;
  };
  
  const handleAddTarget = async () => {
    const result = await addLegalHoldTarget.mutateAsync({
      holdId,
      targetType,
      targetId: targetId.trim(),
      note: targetNote || undefined,
    });
    setAddedTargets((prev) => [...prev, { type: targetType, id: targetId.trim() }]);
    setTargetId('');
    setTargetNote('');
    return result;
  };
  
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/app/operator/legal">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Scale className="h-6 w-6" />
            Legal Hold
          </h1>
          <p className="text-muted-foreground text-sm font-mono">{holdId}</p>
        </div>
        {isReleased && (
          <Badge variant="secondary" data-testid="badge-released">
            <Check className="h-3 w-3 mr-1" />
            Released
          </Badge>
        )}
      </div>
      
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList data-testid="tabs-hold-detail">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="targets" data-testid="tab-targets">Targets</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <Card data-testid="card-hold-info">
            <CardHeader>
              <CardTitle className="text-base">Hold Information</CardTitle>
              <CardDescription>Details about this legal hold</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Hold ID</dt>
                  <dd className="font-mono">{holdId}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Badge variant={isReleased ? 'secondary' : 'default'}>
                      {isReleased ? 'Released' : 'Active'}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          
          <OperatorActionPanel
            title="Release Hold"
            description="Release this legal hold when retention is no longer required"
            actionLabel="Release Hold"
            onAction={handleReleaseHold}
            disabled={isReleased}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Release</label>
              <Textarea
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="Document why this hold is being released"
                rows={3}
                disabled={isReleased}
                data-testid="textarea-release-reason"
              />
            </div>
          </OperatorActionPanel>
        </TabsContent>
        
        <TabsContent value="targets" className="space-y-4">
          <OperatorActionPanel
            title="Add Target"
            description="Add records to this legal hold"
            actionLabel="Add Target"
            onAction={handleAddTarget}
            disabled={isReleased}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Type</label>
                <Select
                  value={targetType}
                  onValueChange={(v) => setTargetType(v as LegalHoldTargetType)}
                  disabled={isReleased}
                >
                  <SelectTrigger data-testid="select-target-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Target ID</label>
                <Input
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="Enter target UUID"
                  disabled={isReleased}
                  data-testid="input-target-id"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Note (optional)</label>
                <Textarea
                  value={targetNote}
                  onChange={(e) => setTargetNote(e.target.value)}
                  placeholder="Add context for this target"
                  rows={2}
                  disabled={isReleased}
                  data-testid="textarea-target-note"
                />
              </div>
            </div>
          </OperatorActionPanel>
          
          {addedTargets.length > 0 && (
            <Card data-testid="card-added-targets">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Added Targets ({addedTargets.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {addedTargets.map((target, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 border rounded-md text-sm"
                      data-testid={`target-item-${idx}`}
                    >
                      <Badge variant="outline">{target.type}</Badge>
                      <span className="font-mono text-muted-foreground">
                        {target.id.substring(0, 8)}...
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card data-testid="card-targets-info">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Existing Targets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No list endpoint available. Targets added in this session are shown above.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="audit" className="space-y-4">
          <AuditFeedWithFilter filterId={holdId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
