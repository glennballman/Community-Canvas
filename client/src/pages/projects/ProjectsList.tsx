import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Plus, Search, ArrowRight, Calendar, Clock, DollarSign,
  MapPin, User, Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  contact_id: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  organization_id: string | null;
  organization_name: string | null;
  property_id: string | null;
  property_name: string | null;
  property_address: string | null;
  quoted_amount: number | null;
  final_amount: number | null;
  deposit_required: number | null;
  deposit_received: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  completed_at: string | null;
  photos_count: number;
  notes_count: number;
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
  return new Date(dateStr).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

export default function ProjectsList() {
  const [activeTab, setActiveTab] = useState<string>('active');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<{ projects: Project[] }>({
    queryKey: ['/api/projects', activeTab, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      const res = await fetch(`/api/projects?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const activeStatuses = ['lead', 'quote', 'approved', 'scheduled', 'in_progress'];
  const completedStatuses = ['completed', 'invoiced', 'paid'];

  const allProjects = data?.projects || [];
  const projects = activeTab === 'all' 
    ? allProjects
    : activeTab === 'active' 
    ? allProjects.filter(p => activeStatuses.includes(p.status))
    : activeTab === 'completed'
    ? allProjects.filter(p => completedStatuses.includes(p.status))
    : allProjects;

  return (
    <div className="flex-1 p-4 space-y-4" data-testid="page-projects-list">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Projects</h1>
          <p className="text-muted-foreground text-sm">Track jobs from lead to paid</p>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button data-testid="button-new-project">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/app/projects/new?mode=new" className="flex items-center gap-2" data-testid="menu-new-job">
                <Briefcase className="w-4 h-4" />
                New Job (Lead/Quote)
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/app/projects/new?mode=completed" className="flex items-center gap-2" data-testid="menu-backwards-entry">
                <Clock className="w-4 h-4" />
                I Already Did This Job
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active">Active</TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">Completed</TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="loading-indicator">Loading...</div>
          ) : projects.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground" data-testid="text-empty-state">
                  No projects found
                </p>
                <Link to="/app/projects/new?mode=new">
                  <Button variant="outline" className="mt-4" data-testid="button-create-first">
                    <Plus className="w-4 h-4 mr-2" />
                    Create your first project
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => {
                const statusConfig = STATUS_CONFIG[project.status] || { label: project.status, color: 'bg-muted text-muted-foreground' };
                const displayAmount = project.final_amount || project.quoted_amount;
                const contactName = project.contact_first_name 
                  ? `${project.contact_first_name} ${project.contact_last_name || ''}`.trim()
                  : project.organization_name || null;
                
                return (
                  <Link key={project.id} to={`/app/projects/${project.id}`}>
                    <Card className="hover-elevate cursor-pointer" data-testid={`card-project-${project.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs text-muted-foreground" data-testid={`text-ref-${project.id}`}>
                                PRJ-{project.id.slice(0, 8).toUpperCase()}
                              </span>
                              <Badge className={statusConfig.color} data-testid={`badge-status-${project.id}`}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <p className="font-medium truncate mt-1" data-testid={`text-title-${project.id}`}>
                              {project.title}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                              {contactName && (
                                <span className="flex items-center gap-1" data-testid={`text-contact-${project.id}`}>
                                  <User className="w-3 h-3" />
                                  {contactName}
                                </span>
                              )}
                              {(project.property_address || project.property_name) && (
                                <span className="flex items-center gap-1 truncate" data-testid={`text-address-${project.id}`}>
                                  <MapPin className="w-3 h-3" />
                                  {project.property_address || project.property_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            {displayAmount && (
                              <div className="text-right">
                                <p className="text-sm font-medium" data-testid={`text-amount-${project.id}`}>
                                  {formatCurrency(displayAmount)}
                                </p>
                              </div>
                            )}
                            {project.scheduled_start && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span data-testid={`text-date-${project.id}`}>{formatDate(project.scheduled_start)}</span>
                              </div>
                            )}
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
