/**
 * STEP 11C: Notify Stakeholders Modal
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
import { useToast } from '@/hooks/use-toast';
import { useCopy } from '@/copy/useCopy';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Info, Mail, Copy, Check, Send, Eye, Clock, AlertCircle, Link as LinkIcon } from 'lucide-react';

interface Invitation {
  id: string;
  invitee_email: string;
  invitee_name: string | null;
  status: string;
  sent_at?: string;
  viewed_at?: string;
  claimed_at?: string;
  claim_token_expires_at?: string;
  claim_url?: string;
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
  error?: string;
}

interface NotifyStakeholdersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  runName?: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'sent':
      return <Badge variant="secondary" data-testid="badge-status-sent"><Send className="w-3 h-3 mr-1" />Sent</Badge>;
    case 'viewed':
      return <Badge variant="outline" className="border-blue-500/50 text-blue-500" data-testid="badge-status-viewed"><Eye className="w-3 h-3 mr-1" />Viewed</Badge>;
    case 'claimed':
      return <Badge variant="default" data-testid="badge-status-claimed"><Check className="w-3 h-3 mr-1" />Claimed</Badge>;
    case 'expired':
      return <Badge variant="destructive" data-testid="badge-status-expired"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
    case 'revoked':
      return <Badge variant="destructive" data-testid="badge-status-revoked"><AlertCircle className="w-3 h-3 mr-1" />Revoked</Badge>;
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

  const { data: existingInvitations, isLoading: loadingExisting } = useQuery<ListResponse>({
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
        queryClient.invalidateQueries({ queryKey: ['/api/provider/runs', runId, 'stakeholder-invites'] });
        toast({
          title: resolve('provider.notify.created.title'),
          description: `${data.invitations.length} invitation(s) created`,
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create invitations',
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

  const copyToClipboard = async (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(url);
      toast({ title: resolve('provider.notify.copied') });
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    setCreatedInvitations([]);
    onOpenChange(false);
  };

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
                          {copiedUrl === inv.claim_url ? resolve('provider.notify.copied') : resolve('provider.notify.copy')}
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
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                        data-testid={`invitation-item-${inv.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{inv.invitee_email}</p>
                          {inv.invitee_name && (
                            <p className="text-xs text-muted-foreground">{inv.invitee_name}</p>
                          )}
                          {inv.viewed_at && (
                            <p className="text-xs text-muted-foreground">
                              Viewed: {new Date(inv.viewed_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {getStatusBadge(inv.status)}
                      </div>
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
