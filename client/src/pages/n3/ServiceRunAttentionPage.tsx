/**
 * N3 Service Run Attention Page
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 * 
 * Shows all service runs requiring attention with open replan bundles
 */

import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useN3Attention, useN3DismissBundle, useN3Status } from '@/hooks/n3/useN3';
import { AttentionQueueTable } from '@/components/n3/AttentionQueueTable';
import { useToast } from '@/hooks/use-toast';

const TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export default function ServiceRunAttentionPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { 
    data: attentionData, 
    isLoading,
    refetch,
    isRefetching 
  } = useN3Attention(TEST_TENANT_ID);
  
  const { data: status } = useN3Status();
  const dismissMutation = useN3DismissBundle(TEST_TENANT_ID);

  const handleView = (bundleId: string, runId: string) => {
    setLocation(`/app/n3/monitor/${runId}?bundle=${bundleId}`);
  };

  const handleDismiss = async (bundleId: string) => {
    try {
      await dismissMutation.mutateAsync({ bundleId });
      toast({
        title: 'Bundle dismissed',
        description: 'The replan bundle has been dismissed.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to dismiss bundle.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-orange-500" />
            Service Run Attention Queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and address risk conditions for upcoming service runs
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <Badge variant={status.isEnabled ? 'default' : 'secondary'}>
              Monitor: {status.isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            data-testid="refresh-attention"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Open Bundles</span>
            {attentionData?.bundles && (
              <Badge variant="outline">
                {attentionData.bundles.filter(b => b.status === 'open').length} requiring action
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AttentionQueueTable
            bundles={attentionData?.bundles || []}
            isLoading={isLoading}
            onView={handleView}
            onDismiss={handleDismiss}
          />
        </CardContent>
      </Card>
    </div>
  );
}
