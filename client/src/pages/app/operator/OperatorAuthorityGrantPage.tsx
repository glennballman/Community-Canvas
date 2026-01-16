/**
 * OperatorAuthorityGrantPage - View/manage a specific authority grant
 * Route: /app/operator/authority/grants/:grantId
 * 
 * Fetches live grant data and allows revocation.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { Shield, ArrowLeft, Copy, Check, Info, RefreshCw, AlertTriangle, ShieldCheck, ShieldX, Clock, Users, Key } from 'lucide-react';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';
import { useGetAuthorityGrant } from '@/lib/api/authority/useGetAuthorityGrant';
import { useRevokeAuthorityGrant } from '@/lib/api/authority/useRevokeAuthorityGrant';
import { useToast } from '@/hooks/use-toast';

export default function OperatorAuthorityGrantPage() {
  const { grantId } = useParams<{ grantId: string }>();
  const [copied, setCopied] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const { toast } = useToast();

  const { data: grant, isLoading, error, refetch } = useGetAuthorityGrant(grantId);
  const revokeMutation = useRevokeAuthorityGrant();

  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!grantId || !revokeReason.trim()) return;
    
    try {
      await revokeMutation.mutateAsync({
        grantId,
        reason: revokeReason.trim(),
      });
      setRevokeDialogOpen(false);
      setRevokeReason('');
      toast({
        title: 'Grant Revoked',
        description: 'The authority grant and all associated tokens have been revoked.',
      });
    } catch (err) {
      toast({
        title: 'Revocation Failed',
        description: err instanceof Error ? err.message : 'Failed to revoke grant',
        variant: 'destructive',
      });
    }
  };

  if (!grantId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-6">
            <p className="text-center text-muted-foreground">No grant ID provided</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Active</Badge>;
      case 'revoked':
        return <Badge variant="destructive" className="flex items-center gap-1"><ShieldX className="h-3 w-3" />Revoked</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-operator-authority-grant">
      <div className="flex items-center gap-3">
        <Link to="/app/operator/authority">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Shield className="h-6 w-6" />
        <div className="flex-1">
          <h1 className="text-xl font-bold">Authority Grant</h1>
          <p className="text-sm text-muted-foreground">Grant details and management</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline">Grant ID</Badge>
        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{grantId}</code>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleCopy(grantId)}
          data-testid="button-copy-grant-id"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      <Separator />

      {isLoading && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading grant details...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card data-testid="card-error">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span>{error instanceof Error ? error.message : 'Failed to load grant'}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              This could mean the grant does not exist, has been deleted, or you do not have access.
            </p>
          </CardContent>
        </Card>
      )}

      {grant && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card data-testid="card-grant-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4" />
                Grant Information
              </CardTitle>
              <CardDescription>
                {grant.title || 'Authority access grant'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Status</div>
                  {getStatusBadge(grant.status)}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Type</div>
                  <Badge variant="outline">{grant.grant_type}</Badge>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Created</div>
                  <div className="text-sm">{formatDate(grant.created_at)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Expires</div>
                  <div className="text-sm">{formatDate(grant.expires_at)}</div>
                </div>
              </div>

              {grant.description && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Description</div>
                  <p className="text-sm">{grant.description}</p>
                </div>
              )}

              {grant.status === 'revoked' && grant.revoke_reason && (
                <div className="p-3 bg-destructive/10 rounded-md space-y-1">
                  <div className="text-sm font-medium text-destructive">Revocation Reason</div>
                  <p className="text-sm">{grant.revoke_reason}</p>
                  {grant.revoked_at && (
                    <p className="text-xs text-muted-foreground">Revoked: {formatDate(grant.revoked_at)}</p>
                  )}
                </div>
              )}

              {grant.status === 'active' && (
                <div className="pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setRevokeDialogOpen(true)}
                    data-testid="button-revoke-grant"
                  >
                    Revoke Access
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card data-testid="card-scopes">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Scopes ({grant.scopes?.length || 0})
                </CardTitle>
                <CardDescription>Resources accessible via this grant</CardDescription>
              </CardHeader>
              <CardContent>
                {grant.scopes && grant.scopes.length > 0 ? (
                  <div className="space-y-2">
                    {grant.scopes.map((scope) => (
                      <div key={scope.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                        <div>
                          <Badge variant="outline" className="text-xs">{scope.scope_type}</Badge>
                          {scope.label && <span className="ml-2">{scope.label}</span>}
                        </div>
                        <code className="text-xs font-mono truncate max-w-32">{scope.scope_id.slice(0, 8)}...</code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No scopes defined</p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-tokens">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Key className="h-4 w-4" />
                  Tokens ({grant.tokens?.length || 0})
                </CardTitle>
                <CardDescription>Access tokens issued for this grant</CardDescription>
              </CardHeader>
              <CardContent>
                {grant.tokens && grant.tokens.length > 0 ? (
                  <div className="space-y-2">
                    {grant.tokens.map((token) => (
                      <div key={token.id} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(token.status)}
                          <span className="text-xs text-muted-foreground">
                            Accessed {token.access_count} times
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {token.last_accessed_at ? `Last: ${formatDate(token.last_accessed_at)}` : 'Never accessed'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No tokens issued</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

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
              <Label htmlFor="revoke-reason">Reason for Revocation</Label>
              <Input
                id="revoke-reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Enter reason for revocation"
                data-testid="input-revoke-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={!revokeReason.trim() || revokeMutation.isPending}
              data-testid="button-confirm-revoke"
            >
              {revokeMutation.isPending ? 'Revoking...' : 'Revoke Grant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="text-xs text-muted-foreground">
        All grant operations are recorded in the operator audit log.
      </div>
    </div>
  );
}
