import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Phone, Mail, MessageCircle, MapPin, Clock, 
  DollarSign, ArrowRight, Check, X, AlertTriangle, Pencil,
  Briefcase, Plus, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface WorkRequest {
  id: string;
  status: 'new' | 'contacted' | 'quoted' | 'converted' | 'closed' | 'spam';
  contact_channel_type: string;
  contact_channel_value: string;
  contact_id: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  property_id: string | null;
  property_address: string | null;
  property_name: string | null;
  summary: string | null;
  description: string | null;
  category: string | null;
  priority: string | null;
  urgency: string | null;
  location_text: string | null;
  estimated_value: number | null;
  quoted_amount: number | null;
  closed_reason: string | null;
  converted_to_project_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkRequestNote {
  id: string;
  content: string;
  note_type: string;
  created_at: string;
}

const STATUS_CONFIG = {
  new: { label: 'New', color: 'bg-blue-500/20 text-blue-400' },
  contacted: { label: 'Contacted', color: 'bg-yellow-500/20 text-yellow-400' },
  quoted: { label: 'Quoted', color: 'bg-purple-500/20 text-purple-400' },
  converted: { label: 'Converted', color: 'bg-green-500/20 text-green-400' },
  closed: { label: 'Closed', color: 'bg-muted text-muted-foreground' },
  spam: { label: 'Spam', color: 'bg-red-500/20 text-red-400' },
} as const;

const CHANNEL_ICONS = {
  phone: Phone,
  email: Mail,
  text: MessageCircle,
  facebook: MessageCircle,
  instagram: MessageCircle,
  walkin: Check,
  referral: ArrowRight,
  other: MessageCircle,
} as const;

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const formatCurrency = (amount: number | null) => {
  if (!amount) return '--';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount);
};

export default function WorkRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [projectTitle, setProjectTitle] = useState('');

  const { data: request, isLoading } = useQuery<WorkRequest>({
    queryKey: ['/api/work-requests', id],
    queryFn: async () => {
      const res = await fetch(`/api/work-requests/${id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!id,
  });

  const { data: notesData } = useQuery<{ notes: WorkRequestNote[] }>({
    queryKey: ['/api/work-requests', id, 'notes'],
    queryFn: async () => {
      const res = await fetch(`/api/work-requests/${id}/notes`);
      if (!res.ok) throw new Error('Failed to fetch notes');
      return res.json();
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<WorkRequest>) => {
      const res = await apiRequest('PATCH', `/api/work-requests/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-requests'] });
      toast({ title: 'Updated', description: 'Work request updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    }
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/work-requests/${id}/convert`, {
        project_title: projectTitle || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-requests'] });
      toast({ title: 'Converted', description: 'Work request converted to project' });
      setConvertDialogOpen(false);
      if (data.project_id) {
        navigate(`/projects/${data.project_id}`);
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to convert', variant: 'destructive' });
    }
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/work-requests/${id}/close`, {
        reason: closeReason || 'closed',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-requests'] });
      toast({ title: 'Closed', description: 'Work request closed' });
      setCloseDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to close', variant: 'destructive' });
    }
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/work-requests/${id}/notes`, {
        content: noteContent,
        note_type: 'note',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-requests', id, 'notes'] });
      toast({ title: 'Note added' });
      setNoteDialogOpen(false);
      setNoteContent('');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add note', variant: 'destructive' });
    }
  });

  if (isLoading) {
    return <div className="flex-1 p-4 text-center text-muted-foreground" data-testid="loading">Loading...</div>;
  }

  if (!request) {
    return <div className="flex-1 p-4 text-center text-muted-foreground" data-testid="not-found">Work request not found</div>;
  }

  const ChannelIcon = CHANNEL_ICONS[request.contact_channel_type as keyof typeof CHANNEL_ICONS] || MessageCircle;
  const statusConfig = STATUS_CONFIG[request.status];
  const notes = notesData?.notes || [];

  const canConvert = ['new', 'contacted', 'quoted'].includes(request.status);
  const canClose = ['new', 'contacted', 'quoted'].includes(request.status);

  return (
    <div className="flex-1 p-4 space-y-6" data-testid="page-work-request-detail">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/intake/work-requests')} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground" data-testid="text-ref">
              WR-{request.id.slice(0, 8).toUpperCase()}
            </span>
            <Badge className={statusConfig.color} data-testid="badge-status">
              {statusConfig.label}
            </Badge>
          </div>
          <h1 className="text-xl font-bold mt-1" data-testid="text-title">
            {request.contact_first_name ? `${request.contact_first_name} ${request.contact_last_name || ''}`.trim() : request.contact_channel_value}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {canConvert && (
            <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" data-testid="button-convert">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Convert to Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convert to Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This will create a new project from this work request and mark it as converted.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="project_title">Project Title (optional)</Label>
                    <Input
                      id="project_title"
                      placeholder={request.description || 'New project from work request'}
                      value={projectTitle}
                      onChange={(e) => setProjectTitle(e.target.value)}
                      data-testid="input-project-title"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setConvertDialogOpen(false)} data-testid="button-convert-cancel">
                      Cancel
                    </Button>
                    <Button onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending} data-testid="button-convert-confirm">
                      {convertMutation.isPending ? 'Converting...' : 'Convert'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {canClose && (
            <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-close-request">
                  <X className="w-4 h-4 mr-2" />
                  Close
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Close Work Request</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="close_reason">Reason</Label>
                    <Select value={closeReason} onValueChange={setCloseReason}>
                      <SelectTrigger data-testid="select-close-reason">
                        <SelectValue placeholder="Select reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_response">No response</SelectItem>
                        <SelectItem value="declined">Customer declined</SelectItem>
                        <SelectItem value="too_expensive">Too expensive</SelectItem>
                        <SelectItem value="out_of_scope">Out of scope</SelectItem>
                        <SelectItem value="duplicate">Duplicate</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCloseDialogOpen(false)} data-testid="button-close-cancel">
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending} data-testid="button-close-confirm">
                      {closeMutation.isPending ? 'Closing...' : 'Close Request'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Contact Method</p>
                <div className="flex items-center gap-2 mt-1">
                  <ChannelIcon className="w-4 h-4" />
                  <span className="capitalize" data-testid="text-channel-type">{request.contact_channel_type}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Contact Info</p>
                <p className="mt-1" data-testid="text-channel-value">{request.contact_channel_value}</p>
              </div>
            </div>

            {request.property_address && (
              <div>
                <p className="text-sm text-muted-foreground">Property Address</p>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="w-4 h-4" />
                  <span data-testid="text-address">{request.property_address}</span>
                </div>
              </div>
            )}

            {request.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="mt-1 whitespace-pre-wrap" data-testid="text-description">{request.description}</p>
              </div>
            )}

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Urgency</p>
                <p className="mt-1 capitalize" data-testid="text-urgency">{request.urgency || '--'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estimated Value</p>
                <p className="mt-1" data-testid="text-estimated-value">{formatCurrency(request.estimated_value)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quoted Amount</p>
                <p className="mt-1" data-testid="text-quoted-amount">{formatCurrency(request.quoted_amount)}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="mt-1" data-testid="text-created-at">{formatDate(request.created_at)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Updated</p>
                <p className="mt-1" data-testid="text-updated-at">{formatDate(request.updated_at)}</p>
              </div>
            </div>

            {request.converted_to_project_id && (
              <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
                <p className="text-sm text-green-400 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Converted to project
                </p>
                <Button 
                  variant="ghost" 
                  className="p-0 h-auto text-green-400" 
                  onClick={() => navigate(`/app/projects/${request.converted_to_project_id}`)}
                  data-testid="link-project"
                >
                  View Project
                </Button>
              </div>
            )}

            {request.closed_reason && (
              <div className="p-3 rounded-md bg-muted">
                <p className="text-sm text-muted-foreground">
                  Closed: {request.closed_reason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => updateMutation.mutate({ status: 'contacted' })}
                disabled={request.status !== 'new'}
                data-testid="button-mark-contacted"
              >
                <Phone className="w-4 h-4 mr-2" />
                Mark Contacted
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => updateMutation.mutate({ status: 'quoted' })}
                disabled={!['new', 'contacted'].includes(request.status)}
                data-testid="button-mark-quoted"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Mark Quoted
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-red-400"
                onClick={() => updateMutation.mutate({ status: 'spam' })}
                disabled={request.status === 'spam'}
                data-testid="button-mark-spam"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Mark as Spam
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Notes</CardTitle>
              <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" data-testid="button-add-note">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Note</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      placeholder="Enter note..."
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      rows={4}
                      data-testid="textarea-note"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setNoteDialogOpen(false)} data-testid="button-note-cancel">
                        Cancel
                      </Button>
                      <Button onClick={() => addNoteMutation.mutate()} disabled={!noteContent.trim() || addNoteMutation.isPending} data-testid="button-note-save">
                        {addNoteMutation.isPending ? 'Adding...' : 'Add Note'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-notes">No notes yet</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="p-3 rounded-md bg-muted" data-testid={`note-${note.id}`}>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(note.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
