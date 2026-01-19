import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Phone, Loader2, Copy, Check, Send, Link } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { inviteProposalMember, type InvitePayload } from '@/lib/api/proposals';

interface InvitePanelProps {
  proposalId: string;
  onInviteSent?: () => void;
}

const ROLE_OPTIONS = [
  { value: 'party_member', label: 'Party Member' },
  { value: 'co_planner', label: 'Co-Planner' },
  { value: 'kid_planner', label: 'Kid Planner' },
  { value: 'handoff_recipient', label: 'Handoff Recipient' },
  { value: 'partner_invite', label: 'Partner Invite' },
] as const;

export function InvitePanel({ proposalId, onInviteSent }: InvitePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');
  const [contact, setContact] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<InvitePayload['role']>('party_member');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const inviteMutation = useMutation({
    mutationFn: async () => {
      const payload: InvitePayload = {
        contact: {
          [contactType]: contact,
          display_name: displayName || undefined,
        },
        role,
      };
      return inviteProposalMember(proposalId, payload);
    },
    onSuccess: (data) => {
      if (data.ok && data.invitation) {
        setInviteLink(data.invitation.view_url);
        toast({
          title: 'Invitation created',
          description: 'Share the link with your guest',
        });
        queryClient.invalidateQueries({ queryKey: ['/api/p2/app/proposals', proposalId] });
        onInviteSent?.();
      } else {
        toast({
          title: 'Invitation failed',
          description: data.error || 'Unable to create invitation',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });
  
  const copyToClipboard = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({ title: 'Link copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };
  
  const resetForm = () => {
    setContact('');
    setDisplayName('');
    setRole('party_member');
    setInviteLink(null);
    setCopied(false);
  };
  
  const isValid = contact.trim().length > 0;
  
  return (
    <Card data-testid="invite-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4" />
          Invite Participant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!inviteLink ? (
          <>
            <div className="flex gap-2">
              <Button
                variant={contactType === 'email' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setContactType('email')}
                data-testid="contact-type-email"
              >
                <Mail className="w-4 h-4 mr-1" />
                Email
              </Button>
              <Button
                variant={contactType === 'phone' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setContactType('phone')}
                data-testid="contact-type-phone"
              >
                <Phone className="w-4 h-4 mr-1" />
                Phone
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact-input">
                {contactType === 'email' ? 'Email Address' : 'Phone Number'}
              </Label>
              <Input
                id="contact-input"
                type={contactType === 'email' ? 'email' : 'tel'}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={contactType === 'email' ? 'guest@example.com' : '+1 555 123 4567'}
                data-testid="contact-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name (optional)</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Guest's name"
                data-testid="display-name-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role-select">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as InvitePayload['role'])}>
                <SelectTrigger id="role-select" data-testid="role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button
              className="w-full"
              disabled={!isValid || inviteMutation.isPending}
              onClick={() => inviteMutation.mutate()}
              data-testid="create-invite-button"
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Invite'
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-4" data-testid="invite-link-display">
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                <Link className="w-4 h-4" />
                <span>Invite Link</span>
              </div>
              <div className="font-mono text-xs break-all bg-background p-2 rounded border">
                {inviteLink}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={copyToClipboard}
                data-testid="copy-link-button"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={resetForm}
                data-testid="invite-another-button"
              >
                Invite Another
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
