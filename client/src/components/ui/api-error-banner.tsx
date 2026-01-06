import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';

interface ApiErrorBannerProps {
  error: Error | ApiError | null | undefined;
  title?: string;
  onRetry?: () => void;
}

export function ApiErrorBanner({ error, title = 'Failed to load data', onRetry }: ApiErrorBannerProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const isDev = import.meta.env.DEV;

  if (!error) return null;

  const isApiError = error instanceof ApiError || ('traceId' in error && 'code' in error);
  const apiError = isApiError ? (error as ApiError) : null;

  const status = apiError?.status || 500;
  const code = apiError?.code || 'UNKNOWN';
  const traceId = apiError?.traceId || 'unknown';
  const detail = apiError?.detail || error.message;
  const endpoint = apiError?.endpoint || 'unknown';

  const copyDebugPayload = () => {
    const payload = {
      timestamp: new Date().toISOString(),
      endpoint,
      status,
      code,
      traceId,
      detail,
      userAgent: navigator.userAgent,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Alert variant="destructive" className="mb-4" data-testid="api-error-banner">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between gap-2">
        <span>{title}</span>
        <div className="flex items-center gap-2">
          {onRetry && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRetry}
              data-testid="button-retry"
            >
              Retry
            </Button>
          )}
        </div>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono bg-destructive/20 px-1 rounded">
            {status}
          </span>
          <span className="font-mono text-xs opacity-70">{code}</span>
        </div>
        
        {isDev && (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="p-0 h-auto text-xs opacity-70 hover:opacity-100"
              data-testid="button-toggle-details"
            >
              {showDetails ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {showDetails ? 'Hide details' : 'View details'}
            </Button>
            
            {showDetails && (
              <div className="mt-2 p-2 bg-background/50 rounded text-xs font-mono space-y-1 border border-destructive/20">
                <div><span className="opacity-50">traceId:</span> {traceId}</div>
                <div><span className="opacity-50">endpoint:</span> {endpoint}</div>
                <div><span className="opacity-50">detail:</span> {detail}</div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyDebugPayload}
                  className="mt-2 h-6 text-xs"
                  data-testid="button-copy-debug"
                >
                  {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied ? 'Copied!' : 'Copy debug payload'}
                </Button>
              </div>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
