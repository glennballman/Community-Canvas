/**
 * N3 Attention Queue Table Component
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 */

import { ReplanBundleCard } from './ReplanBundleCard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, Inbox } from 'lucide-react';

interface AttentionBundle {
  bundleId: string;
  runId: string;
  runName: string;
  startsAt: string;
  status: 'open' | 'dismissed' | 'actioned';
  reasonCodes: string[];
  summary: string;
  riskDelta: string;
  createdAt: string;
}

interface AttentionQueueTableProps {
  bundles: AttentionBundle[];
  isLoading: boolean;
  onView: (bundleId: string, runId: string) => void;
  onDismiss: (bundleId: string) => void;
}

export function AttentionQueueTable({ 
  bundles, 
  isLoading, 
  onView, 
  onDismiss 
}: AttentionQueueTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="attention-queue-loading">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (bundles.length === 0) {
    return (
      <div 
        className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground"
        data-testid="attention-queue-empty"
      >
        <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
        <h3 className="text-lg font-medium">All Clear</h3>
        <p className="text-sm">No service runs require attention at this time.</p>
      </div>
    );
  }

  const openBundles = bundles.filter(b => b.status === 'open');
  const otherBundles = bundles.filter(b => b.status !== 'open');

  return (
    <div className="space-y-6" data-testid="attention-queue">
      {openBundles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <h3 className="font-medium">Requires Attention ({openBundles.length})</h3>
          </div>
          <div className="space-y-3">
            {openBundles.map(bundle => (
              <ReplanBundleCard
                key={bundle.bundleId}
                bundle={bundle}
                onView={onView}
                onDismiss={onDismiss}
              />
            ))}
          </div>
        </div>
      )}

      {otherBundles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-medium text-muted-foreground">
              Resolved ({otherBundles.length})
            </h3>
          </div>
          <div className="space-y-3 opacity-60">
            {otherBundles.map(bundle => (
              <ReplanBundleCard
                key={bundle.bundleId}
                bundle={bundle}
                onView={onView}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
