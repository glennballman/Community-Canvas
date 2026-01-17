import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Users, ChevronLeft, CheckCircle2, Clock, MessageSquare, 
  FileText, Mail, Phone, MapPin, Building2, Calendar,
  Star, Briefcase, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  resume_url: string | null;
  cover_letter: string | null;
  interview_scheduled_at: string | null;
  interview_completed_at: string | null;
  rating: number | null;
  internal_notes: string | null;
  job_posting_id: string;
  custom_title: string | null;
  portal_name: string;
  portal_slug: string;
  individual_id: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  applicant_location: string | null;
  bundle_count: number;
}

interface ApplicationsResponse {
  ok: boolean;
  job: { id: string; title: string };
  applications: Application[];
  statusCounts: Record<string, number>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
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
  draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  under_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  shortlisted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  interview_scheduled: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  interviewed: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  offer_extended: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  offer_accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  offer_declined: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  withdrawn: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
};

const PIPELINE_STAGES = [
  { key: 'submitted', label: 'New' },
  { key: 'under_review', label: 'Reviewing' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'interview_scheduled', label: 'Interview' },
  { key: 'offer_extended', label: 'Offer' },
  { key: 'offer_accepted', label: 'Hired' },
];

export default function JobApplicationsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('all');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  const [portalChoices, setPortalChoices] = useState<Array<{portal_id: string; portal_name: string; posting_id: string}> | null>(null);
  const [selectedPortalId, setSelectedPortalId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<ApplicationsResponse>({
    queryKey: ['/api/p2/app/jobs', jobId, 'applications', activeTab],
    queryFn: async () => {
      const params = activeTab !== 'all' ? `?status=${activeTab}` : '';
      const res = await fetch(`/api/p2/app/jobs/${jobId}/applications${params}`);
      if (!res.ok) throw new Error('Failed to fetch applications');
      return res.json();
    },
    enabled: !!jobId
  });

  const statusMutation = useMutation({
    mutationFn: async ({ appId, status, note }: { appId: string; status: string; note?: string }) => {
      const res = await apiRequest('POST', `/api/p2/app/jobs/${jobId}/applications/${appId}/status`, { status, note });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Status updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/jobs', jobId, 'applications'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const noteMutation = useMutation({
    mutationFn: async ({ appId, note }: { appId: string; note: string }) => {
      const res = await apiRequest('POST', `/api/p2/app/jobs/${jobId}/applications/${appId}/notes`, { note });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Note added' });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/jobs', jobId, 'applications'] });
      setNoteOpen(false);
      setNewNote('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const emergencyMutation = useMutation({
    mutationFn: async (portalId?: string) => {
      const body: any = { urgency: 'today' };
      if (portalId) body.portal_id = portalId;
      const res = await apiRequest('POST', `/api/p2/app/jobs/${jobId}/emergency-replacement-request`, body);
      return res.json();
    },
    onSuccess: (response: any) => {
      if (response.ok) {
        toast({ title: 'Emergency request created' });
        setEmergencyDialogOpen(false);
        setPortalChoices(null);
        setSelectedPortalId(null);
        navigate(response.employerConfirmationRoute);
      } else if (response.error === 'PORTAL_REQUIRED_FOR_EMERGENCY_REQUEST') {
        setPortalChoices(response.choices);
        if (response.choices?.length > 0) {
          setSelectedPortalId(response.choices[0].portal_id);
        }
      } else {
        toast({ title: 'Error', description: response.message || response.error, variant: 'destructive' });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleEmergencySubmit = () => {
    if (portalChoices && selectedPortalId) {
      emergencyMutation.mutate(selectedPortalId);
    } else {
      emergencyMutation.mutate();
    }
  };

  const applications = data?.applications || [];
  const statusCounts = data?.statusCounts || {};
  const job = data?.job;

  const handleStatusChange = (appId: string, status: string) => {
    statusMutation.mutate({ appId, status });
  };

  const handleAddNote = () => {
    if (selectedApp && newNote.trim()) {
      noteMutation.mutate({ appId: selectedApp.id, note: newNote.trim() });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4" data-testid="page-job-applications-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-6 gap-2">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="p-6" data-testid="page-job-applications-error">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Failed to load applications. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-job-applications">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/jobs">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Jobs
          </Link>
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Applications</h1>
            <p className="text-sm text-muted-foreground">
              {job.title} - {applications.length} total applicants
            </p>
          </div>
        </div>
        <Button 
          variant="destructive"
          onClick={() => setEmergencyDialogOpen(true)}
          data-testid="button-emergency-replacement"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Emergency Replacement
        </Button>
      </div>

      <Dialog open={emergencyDialogOpen} onOpenChange={(open) => {
        setEmergencyDialogOpen(open);
        if (!open) {
          setPortalChoices(null);
          setSelectedPortalId(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Request Emergency Replacement
            </DialogTitle>
            <DialogDescription>
              {portalChoices 
                ? 'This job is posted to multiple portals. Select which one to request from.'
                : 'This creates a priority request to the portal coordinator for an immediate replacement for this position.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {portalChoices ? (
              <div className="space-y-2">
                {portalChoices.map((choice) => (
                  <Button
                    key={choice.portal_id}
                    variant={selectedPortalId === choice.portal_id ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setSelectedPortalId(choice.portal_id)}
                    data-testid={`portal-choice-${choice.portal_id}`}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    {choice.portal_name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                A coordinator will review your request and contact available candidates as quickly as possible.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setEmergencyDialogOpen(false);
                setPortalChoices(null);
                setSelectedPortalId(null);
              }}
              data-testid="button-cancel-emergency"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleEmergencySubmit}
              disabled={emergencyMutation.isPending || (portalChoices && !selectedPortalId)}
              data-testid="button-confirm-emergency"
            >
              {emergencyMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {PIPELINE_STAGES.map(stage => (
          <Card 
            key={stage.key}
            className={`cursor-pointer transition-all ${activeTab === stage.key ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setActiveTab(stage.key)}
            data-testid={`stage-${stage.key}`}
          >
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">{statusCounts[stage.key] || 0}</div>
              <div className="text-xs text-muted-foreground">{stage.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All ({data?.pagination.total || 0})</TabsTrigger>
          {PIPELINE_STAGES.map(stage => (
            <TabsTrigger key={stage.key} value={stage.key} data-testid={`tab-${stage.key}`}>
              {stage.label} ({statusCounts[stage.key] || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {applications.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No applications in this stage
                    </div>
                  ) : (
                    applications.map((app) => (
                      <div 
                        key={app.id} 
                        className="p-4 hover-elevate cursor-pointer"
                        onClick={() => { setSelectedApp(app); setDetailOpen(true); }}
                        data-testid={`application-${app.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">
                                {app.applicant_name || 'Unknown Applicant'}
                              </span>
                              <Badge className={STATUS_COLORS[app.status]} variant="secondary">
                                {STATUS_LABELS[app.status]}
                              </Badge>
                              {app.bundle_count > 0 && (
                                <Badge variant="outline">Campaign</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                              {app.applicant_email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {app.applicant_email}
                                </span>
                              )}
                              {app.applicant_phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {app.applicant_phone}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                via {app.portal_name}
                              </span>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {app.submitted_at && new Date(app.submitted_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedApp?.applicant_name || 'Application Details'}
              {selectedApp && (
                <Badge className={STATUS_COLORS[selectedApp.status]} variant="secondary">
                  {STATUS_LABELS[selectedApp.status]}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Applied via {selectedApp?.portal_name}
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
                {selectedApp.applicant_location && (
                  <div className="flex items-center gap-2 col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedApp.applicant_location}</span>
                  </div>
                )}
              </div>

              {selectedApp.cover_letter && (
                <div>
                  <Label className="text-sm font-medium">Cover Letter</Label>
                  <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap border rounded-md p-3 max-h-32 overflow-y-auto">
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
                <Label className="text-sm font-medium">Move to Stage</Label>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_STAGES.map((stage) => (
                    <Button
                      key={stage.key}
                      variant={selectedApp.status === stage.key ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusChange(selectedApp.id, stage.key)}
                      disabled={statusMutation.isPending}
                      data-testid={`button-move-${stage.key}`}
                    >
                      {stage.label}
                    </Button>
                  ))}
                  <Button
                    variant={selectedApp.status === 'rejected' ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => handleStatusChange(selectedApp.id, 'rejected')}
                    disabled={statusMutation.isPending}
                    data-testid="button-reject"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => { setNoteOpen(true); }}
              data-testid="button-add-note"
            >
              Add Note
            </Button>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Internal Note</DialogTitle>
            <DialogDescription>
              This note is only visible to your team
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
    </div>
  );
}
