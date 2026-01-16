/**
 * OperatorActionPanel - Reusable action card for P2 operations
 */

import { useState, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { OperatorErrorAlert } from './OperatorErrorAlert';

interface OperatorActionPanelProps {
  title: string;
  description?: string;
  children: ReactNode;
  actionLabel: string;
  onAction: () => Promise<unknown>;
  resultRenderer?: (result: Record<string, unknown>) => ReactNode;
  disabled?: boolean;
}

export function OperatorActionPanel({
  title,
  description,
  children,
  actionLabel,
  onAction,
  resultRenderer,
  disabled = false,
}: OperatorActionPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  
  const handleAction = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const res = await onAction();
      setResult(res as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card data-testid={`panel-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        
        <Button
          onClick={handleAction}
          disabled={isLoading || disabled}
          data-testid={`button-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {actionLabel}
        </Button>
        
        <OperatorErrorAlert error={error} />
        
        {result && resultRenderer && (
          <div className="p-3 rounded-md bg-muted text-sm" data-testid="result-display">
            {resultRenderer(result as Record<string, unknown>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
