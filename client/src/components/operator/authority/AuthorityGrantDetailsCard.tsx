/**
 * AuthorityGrantDetailsCard - Display grant result details after sharing
 * Shows grantId, accessUrl, expiry, status, and optional revoke button
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Copy, Check, ExternalLink, ShieldCheck, ShieldX, Clock, HelpCircle, AlertTriangle } from 'lucide-react';

interface AuthorityGrantDetailsCardProps {
  grantId?: string;
  accessUrl?: string;
  expiresAt?: string;
  status?: 'active' | 'revoked' | 'expired' | 'unknown';
  scopeSummary?: string;
  title?: string;
  grantType?: string;
  onRevoke?: (reason: string) => void | Promise<void>;
  revoking?: boolean;
}

const STATUS_CONFIG: Record<string, { icon: typeof ShieldCheck; label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline' }> = {
  active: { icon: ShieldCheck, label: 'Active', variant: 'default' },
  revoked: { icon: ShieldX, label: 'Revoked', variant: 'destructive' },
  expired: { icon: Clock, label: 'Expired', variant: 'secondary' },
  unknown: { icon: HelpCircle, label: 'Unknown', variant: 'outline' },
};

export function AuthorityGrantDetailsCard({
  grantId,
  accessUrl,
  expiresAt,
  status = 'unknown',
  scopeSummary,
  title,
  grantType,
  onRevoke,
  revoking = false,
}: AuthorityGrantDetailsCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');

  const handleCopy = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const StatusIcon = statusConfig.icon;

  const formatExpiry = (iso: string) => {
    try {
      const date = new Date(iso);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch {
      return iso;
    }
  };

  if (!grantId && !accessUrl) {
    return (
      <Card data-testid="authority-grant-details-card">
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            No grant details available yet. Complete a share action to see results.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="authority-grant-details-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Grant Details
        </CardTitle>
        <CardDescription>Authority access grant information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {grantId && (
          <div className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground">Grant ID</div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 truncate">
                {grantId}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => handleCopy(grantId, 'grantId')}
                data-testid="button-copy-grant-id"
              >
                {copiedField === 'grantId' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {accessUrl ? (
          <div className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground">Access URL</div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1 truncate">
                {accessUrl}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => handleCopy(accessUrl, 'accessUrl')}
                data-testid="button-copy-access-url"
              >
                {copiedField === 'accessUrl' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <a href={accessUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-open-access-url">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Access URL not returned; use grant ID lookup.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <div className="text-sm font-medium text-muted-foreground">Status</div>
            <Badge variant={statusConfig.variant} className="flex items-center gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </Badge>
          </div>

          {expiresAt && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Expires</div>
              <div className="text-sm">{formatExpiry(expiresAt)}</div>
            </div>
          )}

          {scopeSummary && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Scope</div>
              <Badge variant="outline">{scopeSummary}</Badge>
            </div>
          )}
        </div>

        {onRevoke && status === 'active' && (
          <div className="pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setRevokeDialogOpen(true)}
              disabled={revoking}
              data-testid="button-revoke-grant"
            >
              Revoke Access
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground pt-2">
          Recorded in operator audit log.
        </div>
      </CardContent>

      <Dialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Revoke Authority Grant
            </DialogTitle>
            <DialogDescription>
              This will immediately revoke access for all tokens associated with this grant.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="revoke-reason-inline">Reason for Revocation</Label>
              <Input
                id="revoke-reason-inline"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Enter reason for revocation"
                data-testid="input-revoke-reason-inline"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (onRevoke && revokeReason.trim()) {
                  await onRevoke(revokeReason.trim());
                  setRevokeDialogOpen(false);
                  setRevokeReason('');
                }
              }}
              disabled={!revokeReason.trim() || revoking}
              data-testid="button-confirm-revoke-inline"
            >
              {revoking ? 'Revoking...' : 'Revoke Grant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
