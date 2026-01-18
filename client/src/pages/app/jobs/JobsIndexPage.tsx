import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Briefcase, Plus, MapPin, Users, MoreHorizontal,
  Edit, Send, Code, Search, XCircle, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { roleCategories, employmentTypes } from '@/lib/api/jobs';

interface Portal {
  id: string;
  name: string;
  slug: string;
}

interface Job {
  id: string;
  title: string;
  role_category: string;
  employment_type: string;
  location_text?: string;
  status: string;
  total_applications: number;
  active_postings: number;
  brand_name_snapshot?: string;
  portals: Portal[] | null;
}

interface JobsResponse {
  ok: boolean;
  data?: {
    jobs: Job[];
    total: number;
    limit: number;
    offset: number;
  };
}

function getStatusBadge(status: string, activePostings: number) {
  if (status === 'closed') {
    return <Badge variant="secondary">Closed</Badge>;
  }
  if (status === 'draft') {
    return <Badge variant="outline">Draft</Badge>;
  }
  if (activePostings > 0) {
    return <Badge className="bg-green-600">Published ({activePostings})</Badge>;
  }
  return <Badge variant="outline">Open</Badge>;
}

function getRoleCategoryLabel(value: string) {
  return roleCategories.find(r => r.value === value)?.label || value;
}

function getEmploymentTypeLabel(value: string) {
  return employmentTypes.find(e => e.value === value)?.label || value;
}

function getInitialFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    status: params.get("status") || "",
    q: params.get("q") || "",
  };
}

export default function JobsIndexPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>(() => getInitialFilters().status);
  const [searchQuery, setSearchQuery] = useState<string>(() => getInitialFilters().q);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const updateUrl = useCallback((status: string, q: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    const newPath = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", newPath);
  }, []);

  useEffect(() => {
    updateUrl(statusFilter, searchQuery);
  }, [statusFilter, searchQuery, updateUrl]);

  const { data, isLoading, error } = useQuery<JobsResponse>({
    queryKey: ['/api/p2/app/jobs', { status: statusFilter, q: searchQuery }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery) params.set('q', searchQuery);
      const url = `/api/p2/app/jobs${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
  });

  const closeJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/p2/app/jobs/${jobId}/close`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/app/jobs'] });
      toast({
        title: "Job closed",
        description: "The job posting has been closed successfully.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to close job posting.",
        variant: "destructive",
      });
    },
  });

  const handleCloseClick = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    setSelectedJobId(jobId);
    setCloseDialogOpen(true);
  };

  const handleConfirmClose = () => {
    if (selectedJobId) {
      closeJobMutation.mutate(selectedJobId);
    }
    setCloseDialogOpen(false);
    setSelectedJobId(null);
  };

  const jobs = data?.data?.jobs || [];
  const total = data?.data?.total || 0;
  const hasActiveFilters = statusFilter !== '' || searchQuery !== '';

  const clearFilters = () => {
    setStatusFilter('');
    setSearchQuery('');
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-jobs-index">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Jobs</h1>
            <p className="text-sm text-muted-foreground">
              {total} job posting{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/app/jobs/embeds')} data-testid="button-embed-config">
            <Code className="h-4 w-4 mr-2" />
            Embeds
          </Button>
          <Button onClick={() => navigate('/app/jobs/new')} data-testid="button-new-job">
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-jobs"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant={statusFilter === '' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setStatusFilter('')}
            data-testid="filter-all"
          >
            All
          </Button>
          <Button 
            variant={statusFilter === 'open' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setStatusFilter('open')}
            data-testid="filter-open"
          >
            Open
          </Button>
          <Button 
            variant={statusFilter === 'draft' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setStatusFilter('draft')}
            data-testid="filter-draft"
          >
            Draft
          </Button>
          <Button 
            variant={statusFilter === 'closed' ? 'default' : 'outline'} 
            size="sm"
            onClick={() => setStatusFilter('closed')}
            data-testid="filter-closed"
          >
            Closed
          </Button>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 text-center text-muted-foreground">
              Failed to load jobs. Please try again.
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-12 text-center">
              <Briefcase className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No jobs yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first job listing to start attracting candidates.
              </p>
              <Button onClick={() => navigate('/app/jobs/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Job
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Portals</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applications</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map(job => (
                  <TableRow 
                    key={job.id} 
                    className="cursor-pointer hover-elevate"
                    onClick={() => navigate(`/app/jobs/${job.id}/destinations`)}
                    data-testid={`row-job-${job.id}`}
                  >
                    <TableCell>
                      <div className="font-medium">{job.title}</div>
                      {job.brand_name_snapshot && (
                        <div className="text-sm text-muted-foreground">
                          {job.brand_name_snapshot}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{getRoleCategoryLabel(job.role_category)}</span>
                    </TableCell>
                    <TableCell>
                      {job.location_text ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          {job.location_text}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {job.portals && job.portals.length > 0 ? (
                          <>
                            {job.portals.slice(0, 2).map((portal) => (
                              <Badge key={portal.id} variant="outline" className="text-xs">
                                {portal.name}
                              </Badge>
                            ))}
                            {job.portals.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{job.portals.length - 2}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(job.status, job.active_postings || 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{job.total_applications || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" data-testid={`button-menu-${job.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/app/jobs/${job.id}/edit`); }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/app/jobs/${job.id}/destinations`); }}>
                            <Send className="h-4 w-4 mr-2" />
                            Destinations
                          </DropdownMenuItem>
                          {job.status === 'open' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e) => handleCloseClick(e, job.id)}
                                className="text-destructive"
                                data-testid={`menu-close-${job.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Close Posting
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > jobs.length && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {jobs.length} of {total} jobs
        </div>
      )}

      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Job Posting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this job posting? This will remove it from all portals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-close">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClose}
              disabled={closeJobMutation.isPending}
              data-testid="button-confirm-close"
            >
              {closeJobMutation.isPending ? "Closing..." : "Close Posting"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
