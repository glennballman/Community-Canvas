import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, Check, X, Pause, Archive, Clock, Eye, 
  Briefcase, Building2, Calendar, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface JobPosting {
  posting_id: string;
  job_id: string;
  portal_id: string;
  publish_state: string;
  posted_at: string;
  title: string;
  description: string;
  role_category: string;
  employment_type: string;
  location_text: string | null;
  brand_name_snapshot: string | null;
  legal_name_snapshot: string | null;
  tenant_name: string | null;
  portal_name: string;
  portal_slug: string;
}

interface ModerationResponse {
  ok: boolean;
  postings: JobPosting[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export default function JobsModerationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('pending');
  const [rejectModal, setRejectModal] = useState<{ open: boolean; posting?: JobPosting }>({ open: false });
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, error } = useQuery<ModerationResponse>({
    queryKey: ['/api/p2/app/mod/jobs', activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/p2/app/mod/jobs?state=${activeTab}`);
      if (!res.ok) throw new Error('Failed to fetch postings');
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (postingId: string) => {
      const res = await apiRequest('POST', `/api/p2/app/mod/jobs/${postingId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Posting approved and published' });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/mod/jobs'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ postingId, reason }: { postingId: string; reason: string }) => {
      const res = await apiRequest('POST', `/api/p2/app/mod/jobs/${postingId}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Posting rejected' });
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/mod/jobs'] });
      setRejectModal({ open: false });
      setRejectReason('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleApprove = (posting: JobPosting) => {
    approveMutation.mutate(posting.posting_id);
  };

  const handleReject = () => {
    if (rejectModal.posting) {
      rejectMutation.mutate({ 
        postingId: rejectModal.posting.posting_id, 
        reason: rejectReason 
      });
    }
  };

  const postings = data?.postings || [];

  return (
    <div className="p-6 space-y-6" data-testid="page-jobs-moderation">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Jobs Moderation</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve job postings for your portal
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="h-4 w-4 mr-2" />
            Pending Review
          </TabsTrigger>
          <TabsTrigger value="published" data-testid="tab-published">
            <Check className="h-4 w-4 mr-2" />
            Published
          </TabsTrigger>
          <TabsTrigger value="rejected" data-testid="tab-rejected">
            <X className="h-4 w-4 mr-2" />
            Rejected
          </TabsTrigger>
          <TabsTrigger value="paused" data-testid="tab-paused">
            <Pause className="h-4 w-4 mr-2" />
            Paused
          </TabsTrigger>
          <TabsTrigger value="archived" data-testid="tab-archived">
            <Archive className="h-4 w-4 mr-2" />
            Archived
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Failed to load postings. Please try again.
              </CardContent>
            </Card>
          ) : postings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No postings</h3>
                <p className="text-muted-foreground">
                  No job postings in this queue.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {postings.map(posting => (
                <Card key={posting.posting_id} data-testid={`posting-${posting.posting_id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-medium">{posting.title}</h3>
                          <Badge variant="outline">{posting.role_category}</Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {posting.brand_name_snapshot || posting.tenant_name || 'Unknown employer'}
                          </span>
                          {posting.location_text && (
                            <span>{posting.location_text}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(posting.posted_at).toLocaleDateString()}
                          </span>
                        </div>

                        {posting.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {posting.description}
                          </p>
                        )}
                      </div>

                      {activeTab === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRejectModal({ open: true, posting })}
                            data-testid={`button-reject-${posting.posting_id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(posting)}
                            disabled={approveMutation.isPending}
                            data-testid={`button-approve-${posting.posting_id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={rejectModal.open} onOpenChange={(open) => setRejectModal({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Posting</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this job posting.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Rejection Reason</Label>
            <Textarea
              id="reason"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Please explain why this posting is being rejected..."
              className="mt-2"
              data-testid="textarea-reject-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal({ open: false })} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              data-testid="button-confirm-reject"
            >
              Reject Posting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
