import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Phone, Mail, MessageCircle, MapPin, Clock, 
  DollarSign, ArrowRight, Check, X, AlertTriangle, Pencil,
  Briefcase, Plus, Trash2, Eye, Lock, Share2
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
import { ContractorAssignmentPicker } from '@/components/ContractorAssignmentPicker';
import { WorkDisclosureSelector, getDefaultDisclosureSelection, type DisclosureSelection } from '@/components/WorkDisclosureSelector';
import { ZoneImpactSummary } from '@/components/ZoneImpactSummary';
import { BundleSimulationSlider } from '@/components/BundleSimulationSlider';
import { getZoneBadgeLabel } from '@/components/ZoneBadge';
import type { ZonePricingModifiers } from '@shared/zonePricing';

interface WorkRequest {
  id: string;
  status: 'new' | 'contacted' | 'quoted' | 'scheduled' | 'completed' | 'dropped' | 'spam';
  contact_channel_type: string;
  contact_channel_value: string;
  person_id: string | null;
  contact_given_name: string | null;
  contact_family_name: string | null;
  property_id: string | null;
  property_address: string | null;
  property_name: string | null;
  portal_id: string | null;
  summary: string | null;
  description: string | null;
  category: string | null;
  priority: string | null;
  location_text: string | null;
  estimated_value: number | null;
  quoted_amount: number | null;
  closed_reason: string | null;
  converted_to_project_id: string | null;
  converted_at: string | null;
  assigned_contractor_person_id: string | null;
  zone_id: string | null;
  zone_name: string | null;
  created_at: string;
  updated_at: string;
}

interface Zone {
  id: string;
  key: string;
  name: string;
  kind: string;
  badge_label_resident?: string | null;
  badge_label_contractor?: string | null;
  badge_label_visitor?: string | null;
  pricingModifiers?: ZonePricingModifiers | null;
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
  scheduled: { label: 'Scheduled', color: 'bg-green-500/20 text-green-400' },
  completed: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-400' },
  dropped: { label: 'Dropped', color: 'bg-muted text-muted-foreground' },
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
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [dropDialogOpen, setDropDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [dropReason, setDropReason] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [disclosureDialogOpen, setDisclosureDialogOpen] = useState(false);
  const [disclosureSelection, setDisclosureSelection] = useState<DisclosureSelection>(getDefaultDisclosureSelection());

  const { data: request, isLoading } = useQuery<WorkRequest>({
    queryKey: ['/api/work-requests', id],
    queryFn: async () => {
      const res = await fetch(`/api/work-requests/${id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      return data.workRequest || data;
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

  // Fetch zones for the portal (using same auth as work requests via apiRequest)
  const { data: zonesData } = useQuery<{ ok: boolean; zones: Zone[] }>({
    queryKey: ['/api/work-requests/zones', request?.portal_id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/work-requests/zones?portalId=${request?.portal_id}`);
      return res.json();
    },
    enabled: !!request?.portal_id,
  });

  const assignZoneMutation = useMutation({
    mutationFn: async (zoneId: string | null) => {
      const res = await apiRequest('PUT', `/api/work-requests/${id}/zone`, { zoneId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-requests', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/work-requests'] });
      toast({ title: 'Zone updated', description: 'Work request zone has been updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update zone', variant: 'destructive' });
    }
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

  const reserveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/work-requests/${id}/reserve`, {
        project_title: projectTitle || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-requests'] });
      toast({ title: 'Scheduled', description: 'Work request scheduled as project' });
      setScheduleDialogOpen(false);
      if (data.project_id) {
        navigate(`/app/projects/${data.project_id}`);
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to reserve', variant: 'destructive' });
    }
  });

  const dropMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/work-requests/${id}/drop`, {
        reason: dropReason || 'dropped',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-requests'] });
      toast({ title: 'Dropped', description: 'Work request marked as dropped' });
      setDropDialogOpen(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to drop', variant: 'destructive' });
    }
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PATCH', `/api/work-requests/${id}`, {
        status: 'completed',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-requests'] });
      toast({ title: 'Completed', description: 'Work request marked as completed' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to complete', variant: 'destructive' });
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

  const assignContractorMutation = useMutation({
    mutationFn: async (contractorId: string | null) => {
      const res = await apiRequest('PATCH', `/api/work-requests/${id}`, {
        assigned_contractor_person_id: contractorId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-requests'] });
      toast({ title: 'Contractor assignment updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to assign contractor', variant: 'destructive' });
    }
  });

  const getAuthHeaders = () => {
    const token = localStorage.getItem('hostToken');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  // PROMPT 8: Handle "Preview as Contractor" button click
  const handlePreviewAsContractor = async () => {
    if (!request?.id || !request?.assigned_contractor_person_id) {
      toast({ title: 'Error', description: 'No contractor assigned', variant: 'destructive' });
      return;
    }
    
    try {
      // Request a preview token
      const res = await fetch('/api/p2/app/work-disclosures/preview-token', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          workRequestId: request.id,
          contractorPersonId: request.assigned_contractor_person_id,
        }),
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate preview token');
      }
      
      const data = await res.json();
      
      // Open preview page in new tab with token (public route, no auth required)
      const previewUrl = `/preview/contractor/work-request/${request.id}?previewToken=${encodeURIComponent(data.token)}`;
      window.open(previewUrl, '_blank');
      
      toast({ title: 'Preview opened', description: 'A new tab has been opened with the contractor view. Token expires in 15 minutes.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to preview', variant: 'destructive' });
    }
  };

  const saveDisclosuresMutation = useMutation({
    mutationFn: async (selection: DisclosureSelection) => {
      const res = await fetch('/api/p2/app/work-disclosures/bulk', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          workRequestId: id,
          assignedContractorPersonId: request?.assigned_contractor_person_id || null,
          visibility: selection.visibilityScope,
          specificContractorId: selection.specificContractorId,
          items: [
            ...(selection.accessConstraints ? [{ itemType: 'access_constraints', itemId: null }] : []),
            ...(selection.propertyNotes ? [{ itemType: 'property_notes', itemId: null }] : []),
            ...selection.workAreas.map(id => ({ itemType: 'work_area', itemId: id })),
            ...selection.workMedia.map(id => ({ itemType: 'work_media', itemId: id })),
            ...selection.communityMedia.map(id => ({ itemType: 'community_media', itemId: id })),
            ...selection.subsystems.map(id => ({ itemType: 'subsystem', itemId: id })),
            ...selection.onSiteResources.map(id => ({ itemType: 'on_site_resource', itemId: id })),
          ]
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save disclosures');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/work-disclosures', id] });
      toast({ title: 'Access shared', description: 'Contractor disclosures updated' });
      setDisclosureDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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

  const canSchedule = ['new', 'contacted', 'quoted'].includes(request.status);
  const canDrop = ['new', 'contacted', 'quoted'].includes(request.status);
  const canComplete = ['new', 'contacted', 'quoted', 'scheduled'].includes(request.status);

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
            {request.contact_given_name ? `${request.contact_given_name} ${request.contact_family_name || ''}`.trim() : request.contact_channel_value}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {canSchedule && (
            <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" data-testid="button-schedule">
                  <Briefcase className="w-4 h-4 mr-2" />
                  Schedule Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule as Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This will create a new project from this work request and mark it as scheduled.
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
                    <Button variant="outline" onClick={() => setScheduleDialogOpen(false)} data-testid="button-schedule-cancel">
                      Cancel
                    </Button>
                    <Button onClick={() => reserveMutation.mutate()} disabled={reserveMutation.isPending} data-testid="button-schedule-confirm">
                      {reserveMutation.isPending ? 'Scheduling...' : 'Schedule'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {canDrop && (
            <Dialog open={dropDialogOpen} onOpenChange={setDropDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-drop-request">
                  <X className="w-4 h-4 mr-2" />
                  Drop
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Drop Work Request</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="drop_reason">Reason</Label>
                    <Select value={dropReason} onValueChange={setDropReason}>
                      <SelectTrigger data-testid="select-drop-reason">
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
                    <Button variant="outline" onClick={() => setDropDialogOpen(false)} data-testid="button-drop-cancel">
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={() => dropMutation.mutate()} disabled={dropMutation.isPending} data-testid="button-drop-confirm">
                      {dropMutation.isPending ? 'Dropping...' : 'Drop Request'}
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
                <p className="text-sm text-muted-foreground">Priority</p>
                <p className="mt-1 capitalize" data-testid="text-priority">{request.priority || '--'}</p>
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

            {request.portal_id && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Zone</p>
                  <Select
                    value={request.zone_id || '_none_'}
                    onValueChange={(value) => {
                      assignZoneMutation.mutate(value === '_none_' ? null : value);
                    }}
                    disabled={assignZoneMutation.isPending}
                  >
                    <SelectTrigger className="w-full max-w-xs" data-testid="select-zone">
                      <SelectValue placeholder="Select zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_">Unzoned</SelectItem>
                      {zonesData?.zones?.map(zone => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {getZoneBadgeLabel(zone, 'resident')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {request.zone_id && zonesData?.zones && (
                  <ZoneImpactSummary
                    zone={(() => {
                      const z = zonesData.zones.find(zn => zn.id === request.zone_id);
                      if (!z) return null;
                      return {
                        id: z.id,
                        key: z.key,
                        name: z.name,
                        badge_label_resident: z.badge_label_resident,
                        badge_label_contractor: z.badge_label_contractor,
                        badge_label_visitor: z.badge_label_visitor,
                        pricingModifiers: z.pricingModifiers,
                      };
                    })()}
                    baseEstimate={typeof request.estimated_value === 'number' ? request.estimated_value : null}
                    viewerContext="resident"
                  />
                )}
                
                {/* Bundle Simulation - Pure UI, no persistence */}
                <BundleSimulationSlider
                  baseEstimate={typeof request.estimated_value === 'number' ? request.estimated_value : null}
                  zoneModifiers={(() => {
                    if (!request.zone_id || !zonesData?.zones) return null;
                    const z = zonesData.zones.find(zn => zn.id === request.zone_id);
                    return z?.pricingModifiers || null;
                  })()}
                />
              </>
            )}

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
                  Scheduled as project
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
                  Dropped: {request.closed_reason}
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

          {/* Contractor Assignment */}
          <ContractorAssignmentPicker
            value={request.assigned_contractor_person_id}
            onChange={(contractorId) => assignContractorMutation.mutate(contractorId)}
            workRequestId={request.id}
            disabled={assignContractorMutation.isPending}
            onPreviewAsContractor={handlePreviewAsContractor}
          />

          {/* Share with Contractor */}
          {request.property_id && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  Work Catalog Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Share property work catalog items with the assigned contractor.
                </p>
                <Dialog open={disclosureDialogOpen} onOpenChange={setDisclosureDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full" data-testid="button-manage-disclosures">
                      <Lock className="w-4 h-4 mr-2" />
                      Manage Access
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Share with Contractor</DialogTitle>
                    </DialogHeader>
                    <WorkDisclosureSelector
                      propertyId={request.property_id}
                      portalId={request.portal_id || undefined}
                      workRequestId={request.id}
                      value={disclosureSelection}
                      onChange={setDisclosureSelection}
                      assignedContractorId={request.assigned_contractor_person_id}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setDisclosureDialogOpen(false)} data-testid="button-disclosure-cancel">
                        Cancel
                      </Button>
                      <Button 
                        onClick={() => saveDisclosuresMutation.mutate(disclosureSelection)} 
                        disabled={saveDisclosuresMutation.isPending || disclosureSelection.visibilityScope === 'private'}
                        data-testid="button-disclosure-save"
                      >
                        {saveDisclosuresMutation.isPending ? 'Saving...' : 'Save Access'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
