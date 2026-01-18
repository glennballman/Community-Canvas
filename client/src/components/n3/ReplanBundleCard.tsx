/**
 * N3 Replan Bundle Card Component
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 */

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { SignalBadges, RiskScoreBadge } from './SignalBadges';

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

interface ReplanBundleCardProps {
  bundle: AttentionBundle;
  onView?: (bundleId: string, runId: string) => void;
  onDismiss?: (bundleId: string) => void;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'open':
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case 'actioned':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'dismissed':
      return <XCircle className="h-4 w-4 text-gray-500" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function parseReasonCodesToFindings(reasonCodes: string[]) {
  return reasonCodes.map((code, idx) => {
    const [signalType, riskLevel] = code.split(':');
    return {
      signalType: signalType || 'unknown',
      riskLevel: riskLevel || 'medium',
      message: code,
    };
  });
}

export function ReplanBundleCard({ bundle, onView, onDismiss }: ReplanBundleCardProps) {
  const riskScore = parseFloat(bundle.riskDelta);
  const riskLevel = riskScore >= 0.85 ? 'critical' : riskScore >= 0.6 ? 'high' : riskScore >= 0.35 ? 'medium' : 'low';
  const findings = parseReasonCodesToFindings(bundle.reasonCodes);
  
  return (
    <Card 
      className="hover-elevate cursor-pointer"
      onClick={() => onView?.(bundle.bundleId, bundle.runId)}
      data-testid={`bundle-card-${bundle.bundleId}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {getStatusIcon(bundle.status)}
            <CardTitle className="text-base font-medium">
              {bundle.runName}
            </CardTitle>
          </div>
          <RiskScoreBadge score={riskScore} level={riskLevel} />
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              Starts {formatDistanceToNow(new Date(bundle.startsAt), { addSuffix: true })}
            </span>
            <span className="text-xs">
              ({format(new Date(bundle.startsAt), 'MMM d, h:mm a')})
            </span>
          </div>
          
          <SignalBadges findings={findings} compact />
          
          <p className="text-sm text-muted-foreground line-clamp-2">
            {bundle.summary}
          </p>
        </div>
      </CardContent>
      
      <CardFooter className="pt-0">
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-muted-foreground">
            Created {formatDistanceToNow(new Date(bundle.createdAt), { addSuffix: true })}
          </span>
          <div className="flex items-center gap-2">
            {bundle.status === 'open' && onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(bundle.bundleId);
                }}
                data-testid={`dismiss-bundle-${bundle.bundleId}`}
              >
                Dismiss
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onView?.(bundle.bundleId, bundle.runId);
              }}
              data-testid={`view-bundle-${bundle.bundleId}`}
            >
              Review
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
