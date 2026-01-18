/**
 * N3 Replan Option Card Component
 * PATENT CC-01 INVENTOR GLENN BALLMAN
 */

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingDown, 
  Clock, 
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Command
} from 'lucide-react';

interface ReplanOption {
  id: string;
  bundleId: string;
  rank: number;
  label: string;
  plan: {
    adjustments: Array<{
      segmentId: string;
      field: string;
      oldValue: unknown;
      newValue: unknown;
      reason: string;
    }>;
    summary: string;
  };
  validation: {
    isValid: boolean;
    constraintViolations: string[];
    dependencyViolations: string[];
  };
  estimatedImpact: {
    riskReduction: number;
    timeChange: number;
    costChange: number;
  };
}

interface ReplanOptionCardProps {
  option: ReplanOption;
  onSelect?: (optionId: string, actionKind: 'suggest' | 'request' | 'dictate') => void;
  isSelected?: boolean;
}

function getActionIcon(kind: 'suggest' | 'request' | 'dictate') {
  switch (kind) {
    case 'suggest':
      return <Lightbulb className="h-4 w-4" />;
    case 'request':
      return <MessageSquare className="h-4 w-4" />;
    case 'dictate':
      return <Command className="h-4 w-4" />;
  }
}

export function ReplanOptionCard({ option, onSelect, isSelected }: ReplanOptionCardProps) {
  const { estimatedImpact, validation, plan } = option;
  
  return (
    <Card 
      className={`${isSelected ? 'border-primary border-2' : ''}`}
      data-testid={`replan-option-${option.rank}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              #{option.rank}
            </Badge>
            <CardTitle className="text-base font-medium">
              {option.label}
            </CardTitle>
          </div>
          {validation.isValid ? (
            <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Valid
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Issues
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <p className="text-sm text-muted-foreground mb-3">
          {plan.summary}
        </p>
        
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-1">
            <TrendingDown className="h-4 w-4 text-green-500" />
            <span className="font-mono">
              -{(estimatedImpact.riskReduction * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="font-mono">
              {estimatedImpact.timeChange > 0 ? '+' : ''}{estimatedImpact.timeChange}h
            </span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-yellow-500" />
            <span className="font-mono">
              {estimatedImpact.costChange > 0 ? '+' : ''}{estimatedImpact.costChange}
            </span>
          </div>
        </div>

        {plan.adjustments.length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            <div className="font-medium mb-1">Adjustments:</div>
            <ul className="list-disc list-inside space-y-0.5">
              {plan.adjustments.slice(0, 3).map((adj, idx) => (
                <li key={idx}>{adj.reason}</li>
              ))}
              {plan.adjustments.length > 3 && (
                <li className="text-muted-foreground">
                  +{plan.adjustments.length - 3} more
                </li>
              )}
            </ul>
          </div>
        )}

        {!validation.isValid && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-700 dark:text-red-300">
            {validation.constraintViolations.concat(validation.dependencyViolations).join(', ')}
          </div>
        )}
      </CardContent>
      
      {onSelect && (
        <CardFooter className="pt-0 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelect(option.id, 'suggest')}
            disabled={!validation.isValid}
            data-testid={`suggest-option-${option.rank}`}
          >
            {getActionIcon('suggest')}
            <span className="ml-1">Suggest</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelect(option.id, 'request')}
            disabled={!validation.isValid}
            data-testid={`request-option-${option.rank}`}
          >
            {getActionIcon('request')}
            <span className="ml-1">Request</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onSelect(option.id, 'dictate')}
            disabled={!validation.isValid}
            data-testid={`dictate-option-${option.rank}`}
          >
            {getActionIcon('dictate')}
            <span className="ml-1">Apply</span>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
