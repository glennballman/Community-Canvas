/**
 * OperatorResultLinks - Display links to generated resources
 */

import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Check } from 'lucide-react';

export interface OperatorResultLinksProps {
  title?: string;
  links: {
    label: string;
    id: string;
    path: string;
    type?: 'holdId' | 'dossierId' | 'defensePackId' | 'grantId' | 'exportId' | 'claimId' | 'disputeId';
  }[];
  accessUrl?: string;
  compact?: boolean;
}

export function OperatorResultLinks({
  title = 'Result',
  links,
  accessUrl,
  compact = false,
}: OperatorResultLinksProps) {
  if (links.length === 0 && !accessUrl) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2 items-center" data-testid="result-links-compact">
        <Check className="h-4 w-4 text-green-500" />
        {links.map((link) => (
          <Link key={link.id} to={link.path} className="flex items-center gap-1">
            <Badge variant="outline" className="hover-elevate" data-testid={`link-${link.type || 'result'}`}>
              {link.label}: {link.id.substring(0, 8)}...
              <ExternalLink className="h-3 w-3 ml-1" />
            </Badge>
          </Link>
        ))}
        {accessUrl && (
          <a href={accessUrl} target="_blank" rel="noopener noreferrer">
            <Badge variant="secondary" className="hover-elevate" data-testid="link-access-url">
              Access URL
              <ExternalLink className="h-3 w-3 ml-1" />
            </Badge>
          </a>
        )}
      </div>
    );
  }

  return (
    <Card data-testid="card-result-links">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Check className="h-4 w-4 text-green-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {links.map((link) => (
          <Link
            key={link.id}
            to={link.path}
            className="flex items-center justify-between p-2 border rounded-md hover-elevate"
            data-testid={`link-${link.type || 'result'}-${link.id}`}
          >
            <div className="space-y-0.5">
              <span className="text-sm font-medium">{link.label}</span>
              <p className="text-xs text-muted-foreground font-mono">{link.id}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
        {accessUrl && (
          <a
            href={accessUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-2 border rounded-md hover-elevate"
            data-testid="link-external-access"
          >
            <div className="space-y-0.5">
              <span className="text-sm font-medium">External Access URL</span>
              <p className="text-xs text-muted-foreground truncate max-w-[300px]">{accessUrl}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
