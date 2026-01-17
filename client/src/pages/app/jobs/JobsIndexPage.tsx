import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Briefcase, Plus, MapPin, Clock, Users, MoreHorizontal,
  Eye, Edit, Send, ChevronRight, Code
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { JobsListResponse, roleCategories, employmentTypes } from '@/lib/api/jobs';

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

export default function JobsIndexPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, error } = useQuery<JobsListResponse>({
    queryKey: ['/api/p2/app/jobs', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const url = `/api/p2/app/jobs${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch jobs');
      return res.json();
    },
  });

  const jobs = data?.jobs || [];

  return (
    <div className="p-6 space-y-6" data-testid="page-jobs-index">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Jobs</h1>
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
                  <TableHead>Type</TableHead>
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
                      <span className="text-sm">{getEmploymentTypeLabel(job.employment_type)}</span>
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
                          <DropdownMenuItem onClick={() => navigate(`/app/jobs/${job.id}/edit`)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/app/jobs/${job.id}/destinations`)}>
                            <Send className="h-4 w-4 mr-2" />
                            Destinations
                          </DropdownMenuItem>
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

      {data?.pagination && data.pagination.total > jobs.length && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {jobs.length} of {data.pagination.total} jobs
        </div>
      )}
    </div>
  );
}
