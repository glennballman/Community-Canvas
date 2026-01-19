import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { forwardToApprover } from '@/lib/api/proposals';

interface ForwardToApproverPanelProps {
  proposalId: string;
}

export function ForwardToApproverPanel({ proposalId }: ForwardToApproverPanelProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const mutation = useMutation({
    mutationFn: () => forwardToApprover(proposalId, { email, note: note || undefined }),
    onSuccess: (data) => {
      if (data.ok && data.handoffUrl) {
        const fullUrl = `${window.location.origin}${data.handoffUrl}`;
        setHandoffUrl(fullUrl);
        toast({
          title: 'Handoff link created',
          description: `Invitation sent to ${data.recipient_email}`,
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create handoff link',
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to forward to approver',
        variant: 'destructive',
      });
    },
  });
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter the approver email address',
        variant: 'destructive',
      });
      return;
    }
    mutation.mutate();
  };
  
  const handleCopy = async () => {
    if (handoffUrl) {
      await navigator.clipboard.writeText(handoffUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Link copied',
        description: 'Handoff link copied to clipboard',
      });
    }
  };
  
  return (
    <Card data-testid="forward-to-approver-panel">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="w-4 h-4" />
          Forward to Approver
        </CardTitle>
      </CardHeader>
      <CardContent>
        {handoffUrl ? (
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Handoff Link</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  value={handoffUrl} 
                  readOnly 
                  className="text-sm"
                  data-testid="handoff-url-input"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopy}
                  data-testid="copy-handoff-url-button"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setHandoffUrl(null);
                setEmail('');
                setNote('');
              }}
              data-testid="create-new-handoff-button"
            >
              Create Another Link
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="approver-email">Approver Email</Label>
              <Input
                id="approver-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="approver@company.com"
                required
                data-testid="approver-email-input"
              />
            </div>
            <div>
              <Label htmlFor="approver-note">Note (optional)</Label>
              <Textarea
                id="approver-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Please approve by Friday..."
                rows={2}
                data-testid="approver-note-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
              data-testid="send-handoff-button"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Link...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to Approver
                </>
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
