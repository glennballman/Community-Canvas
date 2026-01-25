/**
 * STEP 11C: Notify Stakeholders Modal
 * STEP 11C Phase 2A: Enhanced with resend/revoke actions
 * 
 * Modal for creating private stakeholder invitations for a service run.
 * Distinct from portal publishing - this is private ops notifications.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCopy } from '@/copy/useCopy';
import { apiRequest } from '@/lib/queryClient';
import { 
  Loader2, Info, Mail, Copy, Check, Send, Eye, AlertCircle, 
  Link as LinkIcon, RefreshCw, XCircle, MailX
} from 'lucide-react';
import { Hourglass } from 'lucide-react';

interface Invitation {
  id: string;
  invitee_email: string;
  invitee_name: string | null;
  status: string;
  sent_at?: string;
  sent_via?: string;
  viewed_at?: string;
  claimed_at?: string;
  claim_token_expires_at?: string;
  claim_url?: string;
  revoked_at?: string;
  revocation_reason?: string;
}

interface ListResponse {
  ok: boolean;
  run_id: string;
  invitations: Invitation[];
}

interface CreateResponse {
  ok: boolean;
  run_id: string;
  invitations: Invitation[];
  emails_sent?: number;
  emails_skipped?: number;
  email_enabled?: boolean;
  error?: string;
  scope?: string;
  limit?: number;
}

interface NotifyStakeholdersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  runName?: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary" data-testid="badge-status-pending"><Hourglass className="w-3 h-3 mr-1" />Pending</Badge>;
    case 'sent':
      return <Badge variant="secondary" data-testid="badge-status-sent"><Send className="w-3 h-3 mr-1" />Sent</Badge>;
    case 'viewed':
      return <Badge variant="outline" className="border-blue-500/50 text-blue-500" data-testid="badge-status-viewed"><Eye className="w-3 h-3 mr-1" />Viewed</Badge>;
    case 'claimed':
      return <Badge variant="default" data-testid="badge-status-claimed"><Check className="w-3 h-3 mr-1" />Claimed</Badge>;
    case 'expired':
      return <Badge variant="destructive" data-testid="badge-status-expired"><Hourglass className="w-3 h-3 mr-1" />Expired</Badge>;
    case 'revoked':
      return <Badge variant="destructive" data-testid="badge-status-revoked"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
    default:
      return <Badge variant="outline" data-testid="badge-status-default">{status}</Badge>;
  }
}

export function NotifyStakeholdersModal({ open, onOpenChange, runId, runName }: NotifyStakeholdersModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { resolve } = useCopy({ entryPoint: 'service' });

  const [emails, setEmails] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [createdInvitations, setCreatedInvitations] = useState<Invitation[]>([]);
  
  const [revokeDialogOpen, setRevokeDialogOpen] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeSilent, setRevokeSilent] = useState(true);

  const { data: existingInvitations, isLoading: loadingExisting, refetch } = useQuery<ListResponse>({
    queryKey: ['/api/provider/runs', runId, 'stakeholder-invites'],
    queryFn: async () => {
      const res = await fetch(`/api/provider/runs/${runId}/stakeholder-invites`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      return res.json();
    },
    enabled: open,
  });

  const createMutation = useMutation<CreateResponse, Error, void>({
    mutationFn: async (): Promise<CreateResponse> => {
      const emailList = emails
        .split(/[,\n]/)
        .map(e => e.trim())
        .filter(e => e.length > 0);

      if (emailList.length === 0) {
        throw new Error('At least one email address is required');
      }

      const invitees = emailList.map(email => ({
        email,
        name: name.trim() || undefined,
        message: message.trim() || undefined,
      }));

      const res = await apiRequest('POST', `/api/provider/runs/${runId}/stakeholder-invites`, { invitees });
      return res as unknown as CreateResponse;
    },
    onSuccess: (data) => {
      if (data.ok && data.invitations) {
        setCreatedInvitations(data.invitations);
        setEmails('');
        setName('');
        setMessage('');
        refetch();
        
        let desc = `${data.invitations.length} invitation(s) created`;
        if (data.email_enabled && data.emails_sent !== undefined) {
          desc += `, ${data.emails_sent} email(s) sent`;
          if (data.emails_skipped && data.emails_skipped > 0) {
            desc += `, ${data.emails_skipped} skipped`;
          }
        } else if (!data.email_enabled) {
          desc += ' (email delivery unavailable - copy links instead)';
        }
        
        toast({
          title: resolve('provider.notify.created.title'),
          description: desc,
        });
      } else {
        let errorDesc = data.error || 'Failed to create invitations';
        if (data.scope === 'per_request') {
          errorDesc = `Too many invitees. Maximum ${data.limit} per request.`;
        } else if (data.scope === 'tenant_daily') {
          errorDesc = `Daily invitation limit reached (${data.limit})`;
        } else if (data.scope === 'individual_hourly') {
          errorDesc = `Hourly invitation limit reached (${data.limit})`;
        }
        toast({
          title: 'Limit Reached',
          description: errorDesc,
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const res = await apiRequest('POST', `/api/provider/runs/${runId}/stakeholder-invites/${inviteId}/resend`, {});
      return res as { ok: boolean; claim_url?: string; email_delivered?: boolean; error?: string };
    },
    onSuccess: (data, inviteId) => {
      if (data.ok) {
        refetch();
        toast({
          title: 'Invitation Resent',
          description: data.email_delivered ? 'Email sent successfully' : 'Link refreshed (copy to share)',
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to resend invitation',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend invitation',
        variant: 'destructive',
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ inviteId, reason, silent }: { inviteId: string; reason?: string; silent?: boolean }) => {
      const res = await apiRequest('POST', `/api/provider/runs/${runId}/stakeholder-invites/${inviteId}/revoke`, {
        reason: reason || undefined,
        silent,
      });
      return res as { ok: boolean; error?: string };
    },
    onSuccess: (data) => {
      if (data.ok) {
        refetch();
        setRevokeDialogOpen(null);
        setRevokeReason('');
        setRevokeSilent(true);
        toast({
          title: 'Invitation Revoked',
          description: 'The invitation has been cancelled',
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to revoke invitation',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke invitation',
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = async (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(url);
      toast({ title: 'Link copied to clipboard' });
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    setCreatedInvitations([]);
    setRevokeDialogOpen(null);
    setRevokeReason('');
    onOpenChange(false);
  };

  const canResend = (inv: Invitation) => 
    ['sent', 'viewed', 'expired'].includes(inv.status);
  
  const canRevoke = (inv: Invitation) => 
    ['pending', 'sent', 'viewed'].includes(inv.status);

  const emailCount = emails
    .split(/[,\n]/)
    .map(e => e.trim())
    .filter(e => e.length > 0).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-notify-stakeholders">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {resolve('provider.notify.modal.title')}
          </DialogTitle>
          <DialogDescription>
            {runName && <>Sending invitations for: <strong>{runName}</strong></>}
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-info/50 bg-info/10" data-testid="alert-notify-rule">
          <Info className="w-4 h-4" />
          <AlertDescription>
            <strong>{resolve('provider.notify.rule.title')}</strong>
            <p className="text-sm text-muted-foreground mt-1">
              {resolve('provider.notify.rule.body')}
            </p>
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="emails">{resolve('provider.notify.invitees.label')}</Label>
              <Textarea
                id="emails"
                placeholder="stakeholder@example.com"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                rows={3}
                className="mt-1"
                data-testid="input-emails"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {resolve('provider.notify.invitees.help')} ({emailCount} email{emailCount !== 1 ? 's' : ''})
              </p>
            </div>

            <div>
              <Label htmlFor="name">{resolve('provider.notify.name.label')}</Label>
              <Input
                id="name"
                placeholder="Optional display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                data-testid="input-name"
              />
            </div>

            <div>
              <Label htmlFor="message">{resolve('provider.notify.message.label')}</Label>
              <Textarea
                id="message"
                placeholder="Optional personal message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                className="mt-1"
                data-testid="input-message"
              />
            </div>

            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || emailCount === 0}
              className="w-full"
              data-testid="button-send-invitations"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {resolve('provider.notify.send')}
            </Button>
          </div>

          {createdInvitations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3" data-testid="section-created-invitations">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  {resolve('provider.notify.created.title')}
                </h3>
                {createdInvitations.map((inv) => (
                  <Card key={inv.id}>
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{inv.invitee_email}</p>
                        {inv.invitee_name && (
                          <p className="text-xs text-muted-foreground">{inv.invitee_name}</p>
                        )}
                        {(inv as any).email_delivered === false && (
                          <p className="text-xs text-yellow-600 flex items-center gap-1 mt-1">
                            <MailX className="w-3 h-3" />
                            Email unavailable - copy link instead
                          </p>
                        )}
                      </div>
                      {inv.claim_url && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(inv.claim_url!)}
                          data-testid={`button-copy-link-${inv.id}`}
                        >
                          {copiedUrl === inv.claim_url ? (
                            <Check className="w-4 h-4 mr-1" />
                          ) : (
                            <Copy className="w-4 h-4 mr-1" />
                          )}
                          {copiedUrl === inv.claim_url ? 'Copied' : 'Copy Link'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {existingInvitations?.invitations && existingInvitations.invitations.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3" data-testid="section-existing-invitations">
                <h3 className="text-sm font-medium">{resolve('provider.notify.list.title')}</h3>
                {loadingExisting ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {existingInvitations.invitations.map((inv) => (
                      <Card key={inv.id} data-testid={`invitation-item-${inv.id}`}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{inv.invitee_email}</p>
                              {inv.invitee_name && (
                                <p className="text-xs text-muted-foreground">{inv.invitee_name}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(inv.status)}
                                {inv.sent_via && (
                                  <span className="text-xs text-muted-foreground">
                                    via {inv.sent_via}
                                  </span>
                                )}
                              </div>
                              {inv.viewed_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Viewed: {new Date(inv.viewed_at).toLocaleDateString()}
                                </p>
                              )}
                              {inv.claimed_at && (
                                <p className="text-xs text-green-600 mt-1">
                                  Claimed: {new Date(inv.claimed_at).toLocaleDateString()}
                                </p>
                              )}
                              {inv.revoked_at && inv.revocation_reason && (
                                <p className="text-xs text-destructive mt-1">
                                  Reason: {inv.revocation_reason}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {inv.claim_url && inv.status !== 'revoked' && inv.status !== 'claimed' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(inv.claim_url!)}
                                  title="Copy invitation link"
                                  data-testid={`button-copy-${inv.id}`}
                                >
                                  {copiedUrl === inv.claim_url ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                              
                              {canResend(inv) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => resendMutation.mutate(inv.id)}
                                  disabled={resendMutation.isPending}
                                  title="Refresh link and resend"
                                  data-testid={`button-resend-${inv.id}`}
                                >
                                  <RefreshCw className={`w-4 h-4 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
                                </Button>
                              )}
                              
                              {canRevoke(inv) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setRevokeDialogOpen(inv.id)}
                                  title="Revoke invitation"
                                  data-testid={`button-revoke-${inv.id}`}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {revokeDialogOpen === inv.id && (
                            <div className="mt-3 pt-3 border-t space-y-3" data-testid="revoke-dialog">
                              <p className="text-sm text-muted-foreground">
                                Are you sure you want to revoke this invitation?
                              </p>
                              <div>
                                <Label htmlFor={`revoke-reason-${inv.id}`}>Reason (optional)</Label>
                                <Input
                                  id={`revoke-reason-${inv.id}`}
                                  placeholder="Optional reason for revoking"
                                  value={revokeReason}
                                  onChange={(e) => setRevokeReason(e.target.value)}
                                  className="mt-1"
                                  data-testid="input-revoke-reason"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`revoke-silent-${inv.id}`}
                                  checked={revokeSilent}
                                  onCheckedChange={(checked) => setRevokeSilent(!!checked)}
                                  data-testid="checkbox-revoke-silent"
                                />
                                <Label htmlFor={`revoke-silent-${inv.id}`} className="text-sm">
                                  Silent revocation (don't notify invitee)
                                </Label>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => revokeMutation.mutate({
                                    inviteId: inv.id,
                                    reason: revokeReason,
                                    silent: revokeSilent,
                                  })}
                                  disabled={revokeMutation.isPending}
                                  data-testid="button-confirm-revoke"
                                >
                                  {revokeMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  ) : (
                                    <XCircle className="w-4 h-4 mr-1" />
                                  )}
                                  Revoke
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRevokeDialogOpen(null);
                                    setRevokeReason('');
                                  }}
                                  data-testid="button-cancel-revoke"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
