/**
 * STEP 11C: Notify Stakeholders Modal
 * STEP 11C Phase 2A: Enhanced with resend/revoke actions
 * STEP 11C Phase 2B-1: Bulk ingest via CSV/paste + preview + dedupe
 * 
 * Modal for creating private stakeholder invitations for a service run.
 * Distinct from portal publishing - this is private ops notifications.
 */

import { useState, useRef, useEffect } from 'react';
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
import Papa from 'papaparse';
import { 
  Loader2, Info, Mail, Copy, Check, Send, Eye, AlertCircle, 
  Link as LinkIcon, RefreshCw, XCircle, MailX, Upload, Trash2, Users
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

type BulkRowStatus = 'ready' | 'invalid' | 'duplicate_in_input' | 'already_invited' | 'submitted' | 'created' | 'skipped' | 'rate_limited' | 'error';

interface BulkRow {
  row_id: string;
  email_raw: string;
  email: string | null;
  name?: string | null;
  message?: string | null;
  issues: string[];
  status: BulkRowStatus;
  existing_individual?: { id: string; display_name?: string };
}

interface EmailLookupResponse {
  ok: boolean;
  matches: Array<{ email: string; individual_id: string; display_name?: string }>;
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

function getBulkRowBadge(status: BulkRowStatus, resolve: (key: string) => string) {
  switch (status) {
    case 'ready':
      return <Badge variant="secondary" className="bg-green-600/20 text-green-600 border-green-600/30" data-testid="badge-bulk-ready">{resolve('provider.notify.bulk.badge.ready')}</Badge>;
    case 'invalid':
      return <Badge variant="destructive" data-testid="badge-bulk-invalid">{resolve('provider.notify.bulk.badge.invalid')}</Badge>;
    case 'duplicate_in_input':
      return <Badge variant="outline" className="border-yellow-500/50 text-yellow-600" data-testid="badge-bulk-duplicate">{resolve('provider.notify.bulk.badge.duplicate')}</Badge>;
    case 'already_invited':
      return <Badge variant="outline" className="border-blue-500/50 text-blue-500" data-testid="badge-bulk-already">{resolve('provider.notify.bulk.badge.already_invited')}</Badge>;
    case 'created':
      return <Badge variant="default" data-testid="badge-bulk-created">{resolve('provider.notify.bulk.badge.created')}</Badge>;
    case 'rate_limited':
      return <Badge variant="destructive" data-testid="badge-bulk-rate">{resolve('provider.notify.bulk.badge.rate_limited')}</Badge>;
    case 'submitted':
      return <Badge variant="secondary" data-testid="badge-bulk-submitted"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Submitting</Badge>;
    case 'skipped':
      return <Badge variant="outline" data-testid="badge-bulk-skipped">Skipped</Badge>;
    case 'error':
      return <Badge variant="destructive" data-testid="badge-bulk-error">Error</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BATCH_SIZE = 50;

export function NotifyStakeholdersModal({ open, onOpenChange, runId, runName }: NotifyStakeholdersModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { resolve } = useCopy({ entryPoint: 'service' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single invite state (existing)
  const [emails, setEmails] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [createdInvitations, setCreatedInvitations] = useState<Invitation[]>([]);
  
  // Revoke dialog state
  const [revokeDialogOpen, setRevokeDialogOpen] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeSilent, setRevokeSilent] = useState(true);

  // Bulk invite state (new)
  const [bulkMode, setBulkMode] = useState<'paste' | 'csv'>('paste');
  const [bulkText, setBulkText] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSharedMessage, setBulkSharedMessage] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [showBulkSection, setShowBulkSection] = useState(false);
  const [csvParseError, setCsvParseError] = useState<string | null>(null);

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

  // Build set of already-invited emails (excluding revoked/expired)
  const alreadyInvitedEmails = new Set<string>(
    (existingInvitations?.invitations || [])
      .filter(inv => !['revoked', 'expired'].includes(inv.status))
      .map(inv => inv.invitee_email.toLowerCase().trim())
  );

  // Re-evaluate bulk rows when existingInvitations loads (fixes timing gap)
  useEffect(() => {
    if (bulkRows.length === 0 || !existingInvitations) return;
    
    setBulkRows(prev => prev.map(row => {
      // Only update rows that are still ready or were ready before
      if (row.status === 'ready' && row.email && alreadyInvitedEmails.has(row.email)) {
        return {
          ...row,
          status: 'already_invited' as BulkRowStatus,
          issues: [...row.issues.filter(i => i !== 'Already invited to this run'), 'Already invited to this run'],
        };
      }
      return row;
    }));
  }, [existingInvitations]);

  // Single invite mutation (existing)
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
    setBulkRows([]);
    setBulkText('');
    setBulkSharedMessage('');
    setCsvParseError(null);
    setShowBulkSection(false);
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

  // Parse bulk text input
  const parseBulkText = () => {
    setCsvParseError(null);
    const lines = bulkText
      .split(/[,\n]/)
      .map(e => e.trim())
      .filter(e => e.length > 0);

    const seen = new Set<string>();
    const rows: BulkRow[] = lines.map((line, idx) => {
      const email = line.toLowerCase().trim();
      const issues: string[] = [];
      let status: BulkRowStatus = 'ready';

      if (!EMAIL_REGEX.test(email)) {
        issues.push('Invalid email format');
        status = 'invalid';
      } else if (seen.has(email)) {
        issues.push('Duplicate in input');
        status = 'duplicate_in_input';
      } else if (alreadyInvitedEmails.has(email)) {
        issues.push('Already invited to this run');
        status = 'already_invited';
      }
      
      if (status === 'ready') {
        seen.add(email);
      }

      return {
        row_id: `paste-${idx}`,
        email_raw: line,
        email: EMAIL_REGEX.test(email) ? email : null,
        issues,
        status,
      };
    });

    setBulkRows(rows);
    lookupEmails(rows.filter(r => r.email).map(r => r.email!));
  };

  // Parse CSV file
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvParseError(null);
    
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setCsvParseError(resolve('provider.notify.bulk.error.csv_parse'));
          setBulkRows([]);
          return;
        }

        const emailKey = findHeaderKey(results.meta.fields || [], ['email', 'Email', 'E-mail', 'e-mail', 'EMAIL']);
        const nameKey = findHeaderKey(results.meta.fields || [], ['name', 'Name', 'full_name', 'Full Name', 'NAME']);
        const messageKey = findHeaderKey(results.meta.fields || [], ['message', 'Message', 'note', 'Note', 'MESSAGE']);

        const seen = new Set<string>();
        const rows: BulkRow[] = results.data.map((row, idx) => {
          let emailRaw = emailKey ? (row[emailKey] || '').trim() : '';
          // Fallback: if no email header, use first column value
          if (!emailRaw && !emailKey) {
            const firstCol = Object.keys(row)[0];
            emailRaw = firstCol ? (row[firstCol] || '').trim() : '';
          }
          
          const email = emailRaw.toLowerCase().trim();
          const rowName = nameKey ? (row[nameKey] || '').trim() : null;
          const rowMessage = messageKey ? (row[messageKey] || '').trim() : null;
          
          const issues: string[] = [];
          let status: BulkRowStatus = 'ready';

          if (!emailRaw || !EMAIL_REGEX.test(email)) {
            issues.push('Invalid email format');
            status = 'invalid';
          } else if (seen.has(email)) {
            issues.push('Duplicate in input');
            status = 'duplicate_in_input';
          } else if (alreadyInvitedEmails.has(email)) {
            issues.push('Already invited to this run');
            status = 'already_invited';
          }
          
          if (status === 'ready') {
            seen.add(email);
          }

          return {
            row_id: `csv-${idx}`,
            email_raw: emailRaw,
            email: EMAIL_REGEX.test(email) ? email : null,
            name: rowName,
            message: rowMessage,
            issues,
            status,
          };
        });

        setBulkRows(rows);
        lookupEmails(rows.filter(r => r.email).map(r => r.email!));
      },
      error: () => {
        setCsvParseError(resolve('provider.notify.bulk.error.csv_parse'));
        setBulkRows([]);
      }
    });

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const findHeaderKey = (headers: string[], aliases: string[]): string | null => {
    for (const alias of aliases) {
      if (headers.includes(alias)) return alias;
    }
    return null;
  };

  // Look up emails against cc_individuals
  const lookupEmails = async (emails: string[]) => {
    if (emails.length === 0) return;

    try {
      const res = await fetch('/api/provider/identity/email-lookup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      const data: EmailLookupResponse = await res.json();

      if (data.ok && data.matches) {
        const matchMap = new Map(data.matches.map(m => [m.email, m]));
        
        setBulkRows(prev => prev.map(row => {
          if (row.email && matchMap.has(row.email)) {
            const match = matchMap.get(row.email)!;
            return {
              ...row,
              existing_individual: {
                id: match.individual_id,
                display_name: match.display_name,
              },
            };
          }
          return row;
        }));
      }
    } catch (err) {
      console.error('Email lookup failed:', err);
    }
  };

  // Remove a row from bulk preview
  const removeBulkRow = (rowId: string) => {
    setBulkRows(prev => prev.filter(r => r.row_id !== rowId));
  };

  // Submit bulk invitations in batches
  const submitBulkInvitations = async () => {
    const readyRows = bulkRows.filter(r => r.status === 'ready');
    if (readyRows.length === 0) return;

    setBulkSubmitting(true);
    
    // Mark all ready rows as submitted
    setBulkRows(prev => prev.map(r => 
      r.status === 'ready' ? { ...r, status: 'submitted' as BulkRowStatus } : r
    ));

    // Chunk into batches
    const batches: BulkRow[][] = [];
    for (let i = 0; i < readyRows.length; i += BATCH_SIZE) {
      batches.push(readyRows.slice(i, i + BATCH_SIZE));
    }

    let totalCreated = 0;
    let rateLimited = false;

    for (const batch of batches) {
      if (rateLimited) {
        // Mark remaining as rate limited
        setBulkRows(prev => prev.map(r => 
          batch.some(br => br.row_id === r.row_id) ? { ...r, status: 'rate_limited' as BulkRowStatus } : r
        ));
        continue;
      }

      const invitees = batch.map(r => ({
        email: r.email!,
        name: r.name || undefined,
        message: r.message || bulkSharedMessage.trim() || undefined,
      }));

      try {
        const res = await fetch(`/api/provider/runs/${runId}/stakeholder-invites`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitees }),
        });
        
        const data: CreateResponse = await res.json();

        if (res.status === 429) {
          rateLimited = true;
          setBulkRows(prev => prev.map(r => 
            batch.some(br => br.row_id === r.row_id) ? { ...r, status: 'rate_limited' as BulkRowStatus, issues: [...r.issues, data.error || 'Rate limited'] } : r
          ));
          toast({
            title: 'Limit Reached',
            description: resolve('provider.notify.bulk.error.rate_limited'),
            variant: 'destructive',
          });
          continue;
        }

        if (data.ok && data.invitations) {
          const createdEmails = new Set(data.invitations.map(inv => inv.invitee_email.toLowerCase()));
          totalCreated += data.invitations.length;

          setBulkRows(prev => prev.map(r => {
            if (batch.some(br => br.row_id === r.row_id)) {
              if (r.email && createdEmails.has(r.email)) {
                return { ...r, status: 'created' as BulkRowStatus };
              } else {
                return { ...r, status: 'skipped' as BulkRowStatus };
              }
            }
            return r;
          }));
        } else {
          setBulkRows(prev => prev.map(r => 
            batch.some(br => br.row_id === r.row_id) ? { ...r, status: 'error' as BulkRowStatus, issues: [...r.issues, data.error || 'Unknown error'] } : r
          ));
        }
      } catch (err: any) {
        setBulkRows(prev => prev.map(r => 
          batch.some(br => br.row_id === r.row_id) ? { ...r, status: 'error' as BulkRowStatus, issues: [...r.issues, err.message || 'Request failed'] } : r
        ));
      }
    }

    setBulkSubmitting(false);
    refetch();

    if (totalCreated > 0) {
      toast({
        title: resolve('provider.notify.created.title'),
        description: `${totalCreated} invitation(s) created`,
      });
    }
  };

  const readyCount = bulkRows.filter(r => r.status === 'ready').length;
  const createdCount = bulkRows.filter(r => r.status === 'created').length;

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
          {/* Toggle for bulk section */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkSection(!showBulkSection)}
            className="w-full justify-start gap-2"
            data-testid="button-toggle-bulk"
          >
            <Users className="w-4 h-4" />
            {resolve('provider.notify.bulk.title')}
            {showBulkSection ? ' (hide)' : ''}
          </Button>

          {/* Bulk ingest section */}
          {showBulkSection && (
            <div className="space-y-4 p-4 border rounded-md" data-testid="section-bulk-ingest">
              <div className="flex gap-2">
                <Button
                  variant={bulkMode === 'paste' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBulkMode('paste')}
                  data-testid="button-mode-paste"
                >
                  {resolve('provider.notify.bulk.mode.paste')}
                </Button>
                <Button
                  variant={bulkMode === 'csv' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBulkMode('csv')}
                  data-testid="button-mode-csv"
                >
                  <Upload className="w-4 h-4 mr-1" />
                  {resolve('provider.notify.bulk.mode.csv')}
                </Button>
              </div>

              {bulkMode === 'paste' && (
                <div className="space-y-2">
                  <Textarea
                    placeholder={resolve('provider.notify.bulk.paste.placeholder')}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={4}
                    data-testid="input-bulk-paste"
                  />
                  <Button
                    size="sm"
                    onClick={parseBulkText}
                    disabled={!bulkText.trim()}
                    data-testid="button-parse-paste"
                  >
                    Preview
                  </Button>
                </div>
              )}

              {bulkMode === 'csv' && (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleCsvUpload}
                    className="hidden"
                    data-testid="input-csv-file"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-choose-csv"
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    {resolve('provider.notify.bulk.csv.button')}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Accepts headers: email, name, message (or first column as email)
                  </p>
                  {csvParseError && (
                    <Alert variant="destructive">
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>{csvParseError}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Shared message for bulk */}
              {bulkRows.length > 0 && (
                <div>
                  <Label htmlFor="bulk-message">Shared message (optional)</Label>
                  <Textarea
                    id="bulk-message"
                    placeholder="Optional message for all invitations"
                    value={bulkSharedMessage}
                    onChange={(e) => setBulkSharedMessage(e.target.value)}
                    rows={2}
                    className="mt-1"
                    data-testid="input-bulk-message"
                  />
                </div>
              )}

              {/* Preview table */}
              {bulkRows.length > 0 && (
                <div className="space-y-2" data-testid="section-bulk-preview">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      {resolve('provider.notify.bulk.preview.title')} ({bulkRows.length} rows, {readyCount} ready)
                    </h4>
                    <Button
                      size="sm"
                      onClick={submitBulkInvitations}
                      disabled={readyCount === 0 || bulkSubmitting}
                      data-testid="button-bulk-submit"
                    >
                      {bulkSubmitting ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-1" />
                      )}
                      {resolve('provider.notify.bulk.submit')} ({readyCount})
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{resolve('provider.notify.bulk.preview.help')}</p>

                  <div className="max-h-60 overflow-y-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Email</th>
                          <th className="text-left p-2">Name</th>
                          <th className="text-left p-2">Platform</th>
                          <th className="text-left p-2">Status</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map((row) => (
                          <tr key={row.row_id} className="border-t" data-testid={`bulk-row-${row.row_id}`}>
                            <td className="p-2 truncate max-w-[150px]" title={row.email_raw}>
                              {row.email_raw}
                            </td>
                            <td className="p-2 truncate max-w-[100px]">{row.name || '-'}</td>
                            <td className="p-2">
                              {row.existing_individual && (
                                <Badge variant="outline" className="text-xs border-green-500/50 text-green-600" data-testid="badge-on-platform">
                                  {resolve('provider.notify.bulk.badge.on_platform')}
                                </Badge>
                              )}
                            </td>
                            <td className="p-2">
                              <div className="flex flex-col gap-1">
                                {getBulkRowBadge(row.status, resolve)}
                                {row.issues.length > 0 && (
                                  <span className="text-xs text-muted-foreground">{row.issues[0]}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-2">
                              {['ready', 'invalid', 'duplicate_in_input'].includes(row.status) && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => removeBulkRow(row.row_id)}
                                  title={resolve('provider.notify.bulk.remove')}
                                  data-testid={`button-remove-${row.row_id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {createdCount > 0 && (
                    <Alert className="border-green-500/50 bg-green-500/10">
                      <Check className="w-4 h-4 text-green-600" />
                      <AlertDescription>
                        {createdCount} invitation(s) created successfully
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Single invite section (existing) */}
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
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {(inv as any).delivery_channel && (
                            <Badge 
                              variant="outline" 
                              className={
                                (inv as any).delivery_channel === 'in_app' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                (inv as any).delivery_channel === 'both' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                (inv as any).delivery_channel === 'email' ? 'bg-green-50 text-green-700 border-green-200' :
                                'bg-muted text-muted-foreground'
                              }
                              data-testid={`badge-delivery-created-${inv.id}`}
                            >
                              {resolve(`provider.notify.delivery.${(inv as any).delivery_channel}`) || (inv as any).delivery_channel}
                            </Badge>
                          )}
                          {(inv as any).on_platform && (
                            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200" data-testid={`badge-on-platform-created-${inv.id}`}>
                              {resolve('provider.notify.bulk.badge.on_platform')}
                            </Badge>
                          )}
                        </div>
                        {(inv as any).email_delivered === false && !(inv as any).on_platform && (
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
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {getStatusBadge(inv.status)}
                                {inv.sent_via && (
                                  <Badge 
                                    variant="outline" 
                                    className={
                                      inv.sent_via === 'in_app' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      inv.sent_via === 'both' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                      inv.sent_via === 'email' ? 'bg-green-50 text-green-700 border-green-200' :
                                      'bg-muted text-muted-foreground'
                                    }
                                    data-testid={`badge-delivery-${inv.id}`}
                                  >
                                    {resolve(`provider.notify.delivery.${inv.sent_via}`) || inv.sent_via}
                                  </Badge>
                                )}
                                {(inv as any).on_platform && (
                                  <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200" data-testid={`badge-on-platform-${inv.id}`}>
                                    {resolve('provider.notify.bulk.badge.on_platform')}
                                  </Badge>
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
