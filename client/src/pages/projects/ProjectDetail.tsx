import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Clock, DollarSign, MapPin, User,
  Camera, FileText, Plus, Pencil, Check, Image
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface Project {
  id: string;
  project_ref: string;
  title: string;
  description: string | null;
  status: string;
  person_id: string | null;
  contact_name: string | null;
  property_id: string | null;
  property_address: string | null;
  quoted_amount: number | null;
  approved_amount: number | null;
  invoiced_amount: number | null;
  paid_amount: number | null;
  current_scope_version: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  warranty_months: number | null;
  warranty_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectNote {
  id: string;
  content: string;
  note_type: string;
  created_at: string;
}

interface ProjectPhoto {
  id: string;
  photo_url: string;
  photo_type: 'before' | 'during' | 'after';
  caption: string | null;
  taken_at: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  lead: { label: 'Lead', color: 'bg-blue-500/20 text-blue-400' },
  quote: { label: 'Quote', color: 'bg-cyan-500/20 text-cyan-400' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400' },
  scheduled: { label: 'Scheduled', color: 'bg-purple-500/20 text-purple-400' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-400' },
  invoiced: { label: 'Invoiced', color: 'bg-orange-500/20 text-orange-400' },
  paid: { label: 'Paid', color: 'bg-green-600/20 text-green-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400' },
  warranty: { label: 'Warranty', color: 'bg-amber-500/20 text-amber-400' },
};

const formatCurrency = (amount: number | null) => {
  if (!amount) return '--';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-CA', { 
    dateStyle: 'medium'
  });
};

const formatDateTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('details');
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['/api/projects', id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: !!id,
  });

  const { data: notesData } = useQuery<{ notes: ProjectNote[] }>({
    queryKey: ['/api/projects', id, 'notes'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/notes`);
      if (!res.ok) throw new Error('Failed to fetch notes');
      return res.json();
    },
    enabled: !!id,
  });

  const { data: photosData } = useQuery<{ photos: ProjectPhoto[] }>({
    queryKey: ['/api/projects', id, 'photos'],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/photos`);
      if (!res.ok) throw new Error('Failed to fetch photos');
      return res.json();
    },
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest('PATCH', `/api/projects/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: 'Status updated' });
      setStatusDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${id}/notes`, {
        content: noteContent,
        note_type: 'note',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'notes'] });
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

  if (!project) {
    return <div className="flex-1 p-4 text-center text-muted-foreground" data-testid="not-found">Project not found</div>;
  }

  const statusConfig = STATUS_CONFIG[project.status] || { label: project.status, color: 'bg-muted text-muted-foreground' };
  const notes = notesData?.notes || [];
  const photos = photosData?.photos || [];
  const beforePhotos = photos.filter(p => p.photo_type === 'before');
  const duringPhotos = photos.filter(p => p.photo_type === 'during');
  const afterPhotos = photos.filter(p => p.photo_type === 'after');

  const displayAmount = project.approved_amount || project.quoted_amount;

  return (
    <div className="flex-1 p-4 space-y-6" data-testid="page-project-detail">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/projects')} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground" data-testid="text-ref">
              {project.project_ref}
            </span>
            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
              <DialogTrigger asChild>
                <Badge className={`${statusConfig.color} cursor-pointer hover-elevate`} data-testid="badge-status">
                  {statusConfig.label}
                  <Pencil className="w-3 h-3 ml-1" />
                </Badge>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Status</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Select value={newStatus || project.status} onValueChange={setNewStatus}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="quote">Quote</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="invoiced">Invoiced</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="warranty">Warranty</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setStatusDialogOpen(false)} data-testid="button-status-cancel">
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => updateStatusMutation.mutate(newStatus || project.status)} 
                      disabled={updateStatusMutation.isPending}
                      data-testid="button-status-save"
                    >
                      Update
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <h1 className="text-xl font-bold mt-1" data-testid="text-title">
            {project.title}
          </h1>
        </div>
        {displayAmount && (
          <div className="text-right">
            <p className="text-2xl font-bold" data-testid="text-amount">{formatCurrency(displayAmount)}</p>
            {project.paid_amount ? (
              <p className="text-sm text-green-400" data-testid="text-paid">Paid: {formatCurrency(project.paid_amount)}</p>
            ) : project.invoiced_amount ? (
              <p className="text-sm text-orange-400" data-testid="text-invoiced">Invoiced: {formatCurrency(project.invoiced_amount)}</p>
            ) : null}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details" data-testid="tab-details">
            <FileText className="w-4 h-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="photos" data-testid="tab-photos">
            <Camera className="w-4 h-4 mr-2" />
            Photos ({photos.length})
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <FileText className="w-4 h-4 mr-2" />
            Notes ({notes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Job Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="mt-1 whitespace-pre-wrap" data-testid="text-description">{project.description}</p>
                  </div>
                )}

                {project.contact_name && (
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="w-4 h-4" />
                      <span data-testid="text-contact">{project.contact_name}</span>
                    </div>
                  </div>
                )}

                {project.property_address && (
                  <div>
                    <p className="text-sm text-muted-foreground">Job Site</p>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="w-4 h-4" />
                      <span data-testid="text-address">{project.property_address}</span>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Scheduled Start</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" />
                      <span data-testid="text-scheduled-start">{formatDate(project.scheduled_start)}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scheduled End</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" />
                      <span data-testid="text-scheduled-end">{formatDate(project.scheduled_end)}</span>
                    </div>
                  </div>
                </div>

                {project.completed_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Check className="w-4 h-4 text-green-400" />
                      <span data-testid="text-completed">{formatDate(project.completed_at)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Financials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Quoted</p>
                    <p className="text-lg font-medium mt-1" data-testid="text-quoted">{formatCurrency(project.quoted_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Approved</p>
                    <p className="text-lg font-medium mt-1" data-testid="text-approved">{formatCurrency(project.approved_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Invoiced</p>
                    <p className="text-lg font-medium mt-1" data-testid="text-invoiced-amount">{formatCurrency(project.invoiced_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Paid</p>
                    <p className="text-lg font-medium text-green-400 mt-1" data-testid="text-paid-amount">{formatCurrency(project.paid_amount)}</p>
                  </div>
                </div>

                {project.warranty_months && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-muted-foreground">Warranty</p>
                      <p className="mt-1" data-testid="text-warranty">
                        {project.warranty_months} months
                        {project.warranty_expires_at && ` (expires ${formatDate(project.warranty_expires_at)})`}
                      </p>
                    </div>
                  </>
                )}

                <Separator />

                <div className="text-sm text-muted-foreground">
                  <p>Scope Version: {project.current_scope_version}</p>
                  <p>Created: {formatDateTime(project.created_at)}</p>
                  <p>Updated: {formatDateTime(project.updated_at)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Photos</CardTitle>
              <Button size="sm" variant="outline" data-testid="button-add-photo">
                <Plus className="w-4 h-4 mr-2" />
                Add Photo
              </Button>
            </CardHeader>
            <CardContent>
              {photos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-photos">
                  <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No photos yet</p>
                  <p className="text-sm">Add before, during, and after photos to document the job</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {beforePhotos.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">Before</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {beforePhotos.map(photo => (
                          <div key={photo.id} className="aspect-square rounded-md overflow-hidden bg-muted" data-testid={`photo-before-${photo.id}`}>
                            <img src={photo.photo_url} alt={photo.caption || 'Before'} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {duringPhotos.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">During</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {duringPhotos.map(photo => (
                          <div key={photo.id} className="aspect-square rounded-md overflow-hidden bg-muted" data-testid={`photo-during-${photo.id}`}>
                            <img src={photo.photo_url} alt={photo.caption || 'During'} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {afterPhotos.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">After</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {afterPhotos.map(photo => (
                          <div key={photo.id} className="aspect-square rounded-md overflow-hidden bg-muted" data-testid={`photo-after-${photo.id}`}>
                            <img src={photo.photo_url} alt={photo.caption || 'After'} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Notes</CardTitle>
              <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-add-note">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Note
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
                <p className="text-center py-4 text-muted-foreground" data-testid="text-no-notes">No notes yet</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="p-3 rounded-md bg-muted" data-testid={`note-${note.id}`}>
                      <p className="whitespace-pre-wrap">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDateTime(note.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
