import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, Clock, MessageSquare, CheckCircle2, AlertCircle, 
  Filter, RefreshCw, ChevronRight, Home, Briefcase, FileText,
  Send, Building2, Phone, Mail, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Application {
  id: string;
  application_number: string;
  status: string;
  submitted_at: string | null;
  last_activity_at: string | null;
  needs_reply: boolean;
  needs_accommodation: boolean;
  internal_notes: string | null;
  resume_url: string | null;
  cover_letter: string | null;
  job_id: string;
  job_title: string;
  role_category: string | null;
  location_text: string | null;
  job_posting_id: string;
  custom_title: string | null;
  individual_id: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  tenant_id: string;
  employer_name: string | null;
  hours_since_submission: number;
  sla_status: 'green' | 'yellow' | 'red';
  bundle_count: number;
}

interface Template {
  id: string;
  code: string;
  name: string;
  description: string | null;
  subject_template: string;
  body_template: string;
  is_actionable: boolean;
}

interface QueueResponse {
  ok: boolean;
  applications: Application[];
  total: number;
  limit: number;
  offset: number;
}

interface StatsResponse {
  ok: boolean;
  stats: Record<string, {
    count: number;
    needs_reply: number;
    sla_red: number;
    sla_yellow: number;
  }>;
}

interface TemplatesResponse {
  ok: boolean;
  templates: Template[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'New',
  under_review: 'Reviewing',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview',
  interviewed: 'Interviewed',
  offer_extended: 'Offer Sent',
  offer_accepted: 'Hired',
  offer_declined: 'Declined',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  shortlisted: 'bg-purple-100 text-purple-800',
  interview_scheduled: 'bg-indigo-100 text-indigo-800',
  interviewed: 'bg-cyan-100 text-cyan-800',
  offer_extended: 'bg-orange-100 text-orange-800',
  offer_accepted: 'bg-green-100 text-green-800',
  offer_declined: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-800'
};

export default function ApplicationsQueuePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [needsReplyFilter, setNeedsReplyFilter] = useState(false);
  const [housingFilter, setHousingFilter] = useState(false);

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (needsReplyFilter) params.append('needs_reply', 'true');
    if (housingFilter) params.append('housing_needed', 'true');
    return params.toString();
  };

  const { data, isLoading, refetch } = useQuery<QueueResponse>({
    queryKey: ['/api/p2/app/mod/jobs/applications', statusFilter, needsReplyFilter, housingFilter],
    queryFn: async () => {
      const params = buildQueryParams();
      const res = await fetch(`/api/p2/app/mod/jobs/applications?${params}`);
      if (!res.ok) throw new Error('Failed to fetch applications');
      return res.json();
    },
  });

  const { data: statsData } = useQuery<StatsResponse>({
    queryKey: ['/api/p2/app/mod/jobs/applications/stats'],
    queryFn: async () => {
      const res = await fetch('/api/p2/app/mod/jobs/applications/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const { data: templatesData } = useQuery<TemplatesResponse>({
    queryKey: ['/api/p2/app/mod/jobs/templates'],
    queryFn: async () => {
      const res = await fetch('/api/p2/app/mod/jobs/templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ appId, status, note }: { appId: string; status: string; note?: string }) => {
      const res = await apiRequest('POST', `/api/p2/app/mod/jobs/applications/${appId}/status`, { status, note });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Status updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/mod/jobs/applications'] });
      setDetailOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const noteMutation = useMutation({
    mutationFn: async ({ appId, note }: { appId: string; note: string }) => {
      const res = await apiRequest('POST', `/api/p2/app/mod/jobs/applications/${appId}/notes`, { note });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Note added' });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/mod/jobs/applications'] });
      setNoteOpen(false);
      setNewNote('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const replyMutation = useMutation({
    mutationFn: async ({ appId, templateCode }: { appId: string; templateCode: string }) => {
      const res = await apiRequest('POST', `/api/p2/app/mod/jobs/applications/${appId}/reply`, { templateCode });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Reply sent' });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/mod/jobs/applications'] });
      setReplyOpen(false);
      setSelectedTemplate('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const applications = data?.applications || [];
  const stats = statsData?.stats || {};
  const templates = templatesData?.templates || [];

  const totalNewApps = stats.submitted?.count || 0;
  const totalSlaRed = Object.values(stats).reduce((sum, s) => sum + (s.sla_red || 0), 0);
  const totalNeedsReply = Object.values(stats).reduce((sum, s) => sum + (s.needs_reply || 0), 0);

  const handleStatusChange = (appId: string, status: string) => {
    statusMutation.mutate({ appId, status });
  };

  const handleAddNote = () => {
    if (selectedApp && newNote.trim()) {
      noteMutation.mutate({ appId: selectedApp.id, note: newNote.trim() });
    }
  };

  const handleSendReply = () => {
    if (selectedApp && selectedTemplate) {
      replyMutation.mutate({ appId: selectedApp.id, templateCode: selectedTemplate });
    }
  };

  const SlaIndicator = ({ status, hours }: { status: 'green' | 'yellow' | 'red'; hours: number }) => {
    const colors = {
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500'
    };
    return (
      <div className="flex items-center gap-1.5" title={`${Math.round(hours)}h since submission`}>
        <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
        <span className="text-xs text-muted-foreground">{Math.round(hours)}h</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" data-testid="page-applications-queue-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-applications-queue">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Application Queue</h1>
            <p className="text-sm text-muted-foreground">
              Triage and manage incoming job applications
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              New Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{totalNewApps}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              SLA Breached (&gt;24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{totalSlaRed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Needs Reply
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{totalNeedsReply}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="submitted">New</SelectItem>
            <SelectItem value="under_review">Reviewing</SelectItem>
            <SelectItem value="shortlisted">Shortlisted</SelectItem>
            <SelectItem value="interview_scheduled">Interview</SelectItem>
            <SelectItem value="interviewed">Interviewed</SelectItem>
            <SelectItem value="offer_extended">Offer Sent</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant={needsReplyFilter ? "default" : "outline"} 
          size="sm"
          onClick={() => setNeedsReplyFilter(!needsReplyFilter)}
          data-testid="button-needs-reply-filter"
        >
          <MessageSquare className="h-4 w-4 mr-1" />
          Needs Reply
        </Button>

        <Button 
          variant={housingFilter ? "default" : "outline"} 
          size="sm"
          onClick={() => setHousingFilter(!housingFilter)}
          data-testid="button-housing-filter"
        >
          <Home className="h-4 w-4 mr-1" />
          Housing Needed
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="divide-y">
              {applications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No applications match your filters
                </div>
              ) : (
                applications.map((app) => (
                  <div 
                    key={app.id} 
                    className="p-4 hover-elevate cursor-pointer"
                    onClick={() => { setSelectedApp(app); setDetailOpen(true); }}
                    data-testid={`application-row-${app.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {app.applicant_name || 'Unknown Applicant'}
                          </span>
                          <Badge className={STATUS_COLORS[app.status] || ''} variant="secondary">
                            {STATUS_LABELS[app.status] || app.status}
                          </Badge>
                          {app.needs_reply && (
                            <Badge variant="outline" className="border-orange-500 text-orange-600">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Reply
                            </Badge>
                          )}
                          {app.needs_accommodation && (
                            <Badge variant="outline" className="border-purple-500 text-purple-600">
                              <Home className="h-3 w-3 mr-1" />
                              Housing
                            </Badge>
                          )}
                          {app.bundle_count > 0 && (
                            <Badge variant="outline">
                              Bundle ({app.bundle_count})
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {app.custom_title || app.job_title}
                          </span>
                          <span>|</span>
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {app.employer_name}
                          </span>
                          {app.applicant_email && (
                            <>
                              <span>|</span>
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {app.applicant_email}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <SlaIndicator status={app.sla_status} hours={app.hours_since_submission} />
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedApp?.applicant_name || 'Application Details'}
              {selectedApp && (
                <Badge className={STATUS_COLORS[selectedApp.status] || ''} variant="secondary">
                  {STATUS_LABELS[selectedApp.status] || selectedApp.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedApp?.custom_title || selectedApp?.job_title} at {selectedApp?.employer_name}
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedApp.applicant_email || 'No email'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedApp.applicant_phone || 'No phone'}</span>
                </div>
              </div>

              {selectedApp.cover_letter && (
                <div>
                  <Label className="text-sm font-medium">Cover Letter</Label>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedApp.cover_letter}
                  </p>
                </div>
              )}

              {selectedApp.resume_url && (
                <div>
                  <Label className="text-sm font-medium">Resume</Label>
                  <Button variant="ghost" className="p-0 h-auto" asChild>
                    <a href={selectedApp.resume_url} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-4 w-4 mr-1" />
                      View Resume
                    </a>
                  </Button>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Update Status</Label>
                <div className="flex flex-wrap gap-2">
                  {['under_review', 'shortlisted', 'interview_scheduled', 'rejected'].map((status) => (
                    <Button
                      key={status}
                      variant={selectedApp.status === status ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusChange(selectedApp.id, status)}
                      disabled={statusMutation.isPending}
                      data-testid={`button-status-${status}`}
                    >
                      {STATUS_LABELS[status]}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setNoteOpen(true); }}
              data-testid="button-add-note"
            >
              Add Note
            </Button>
            <Button 
              onClick={() => { setReplyOpen(true); }}
              data-testid="button-send-reply"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add an internal note to this application
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Enter your note..."
            className="min-h-[100px]"
            data-testid="textarea-note"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAddNote} 
              disabled={!newNote.trim() || noteMutation.isPending}
              data-testid="button-save-note"
            >
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Reply</DialogTitle>
            <DialogDescription>
              Choose a template to send to the applicant
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger data-testid="select-template">
              <SelectValue placeholder="Select a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.code} value={template.code}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTemplate && (
            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="font-medium mb-1">
                {templates.find(t => t.code === selectedTemplate)?.subject_template}
              </p>
              <p className="text-muted-foreground whitespace-pre-wrap text-xs">
                {templates.find(t => t.code === selectedTemplate)?.body_template.slice(0, 200)}...
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSendReply} 
              disabled={!selectedTemplate || replyMutation.isPending}
              data-testid="button-send-template"
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
