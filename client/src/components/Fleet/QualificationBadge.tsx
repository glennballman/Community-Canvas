import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface QualificationBadgeProps {
  isQualified: boolean;
  issueCount: number;
  warningCount: number;
  primaryIssue?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function QualificationBadge({ 
  isQualified, 
  issueCount, 
  warningCount, 
  primaryIssue,
  size = 'md' 
}: QualificationBadgeProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  const iconSize = sizeClasses[size];

  if (isQualified && warningCount === 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" data-testid="badge-qualified">
            <CheckCircle className={`${iconSize} text-success`} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Fully qualified to tow</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (isQualified && warningCount > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" data-testid="badge-qualified-warnings">
            <Info className={`${iconSize} text-warning`} />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Qualified with {warningCount} warning{warningCount > 1 ? 's' : ''}</p>
          {primaryIssue && <p className="text-xs text-muted-foreground mt-1">{primaryIssue}</p>}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" data-testid="badge-not-qualified">
          <AlertTriangle className={`${iconSize} text-destructive`} />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium text-destructive">Not qualified</p>
        {primaryIssue && <p className="text-xs mt-1">{primaryIssue}</p>}
        {issueCount > 1 && (
          <p className="text-xs text-muted-foreground">+ {issueCount - 1} more issue{issueCount > 2 ? 's' : ''}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export default QualificationBadge;
