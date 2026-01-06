import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { 
  Plus, Phone, Mail, MessageCircle, Clock, 
  Search, ArrowRight, Check, X, AlertTriangle
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
  priority: 'routine' | 'soon' | 'urgent' | 'emergency' | null;
  notes_count: number;
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

const PRIORITY_CONFIG = {
  routine: { label: 'Routine', color: 'bg-muted text-muted-foreground' },
  soon: { label: 'Soon', color: 'bg-blue-500/20 text-blue-400' },
  urgent: { label: 'Urgent', color: 'bg-orange-500/20 text-orange-400' },
  emergency: { label: 'Emergency', color: 'bg-red-500/20 text-red-400' },
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
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

const formatCurrency = (amount: number | null) => {
  if (!amount) return '';
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount);
};

export default function WorkRequestsList() {
  const [activeTab, setActiveTab] = useState<string>('new');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const [newRequest, setNewRequest] = useState({
    contact_channel_value: '',
    contact_channel_type: 'phone' as const,
    contact_first_name: '',
    summary: '',
    priority: '' as string,
  });

  const { data, isLoading } = useQuery<{ workRequests: WorkRequest[], counts: Record<string, number> }>({
    queryKey: ['/api/work-requests', activeTab, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.append('status', activeTab);
      if (search) params.append('search', search);
      const res = await fetch(`/api/work-requests?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  });

  const stats = data?.counts;

  const createMutation = useMutation({
    mutationFn: async (formData: typeof newRequest) => {
      const res = await apiRequest('POST', '/api/work-requests', {
        contact_channel_value: formData.contact_channel_value,
        contact_channel_type: formData.contact_channel_type,
        contact_first_name: formData.contact_first_name || undefined,
        summary: formData.summary || undefined,
        priority: formData.priority || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/work-requests'] });
      setDialogOpen(false);
      setNewRequest({
        contact_channel_value: '',
        contact_channel_type: 'phone',
        contact_first_name: '',
        summary: '',
        priority: '',
      });
      toast({ title: 'Request created', description: 'New work request added to inbox' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create request', variant: 'destructive' });
    }
  });

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.contact_channel_value.trim()) return;
    createMutation.mutate(newRequest);
  };

  const workRequests = data?.workRequests || [];

  return (
    <div className="flex-1 p-4 space-y-4" data-testid="page-work-requests-list">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Work Requests</h1>
          <p className="text-muted-foreground text-sm">Quick capture inbox for incoming work</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-request">
              <Plus className="w-4 h-4 mr-2" />
              Quick Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Quick Add Work Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleQuickAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="channel_type">Contact Method</Label>
                <Select 
                  value={newRequest.contact_channel_type} 
                  onValueChange={(v) => setNewRequest(prev => ({ ...prev, contact_channel_type: v as any }))}
                >
                  <SelectTrigger data-testid="select-channel-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="walkin">Walk-in</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="channel_value">Contact Info*</Label>
                <Input
                  id="channel_value"
                  placeholder="Phone number, email, or name..."
                  value={newRequest.contact_channel_value}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, contact_channel_value: e.target.value }))}
                  data-testid="input-channel-value"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_first_name">Name (optional)</Label>
                <Input
                  id="contact_first_name"
                  placeholder="Customer name"
                  value={newRequest.contact_first_name}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, contact_first_name: e.target.value }))}
                  data-testid="input-contact-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Notes (optional)</Label>
                <Textarea
                  id="summary"
                  placeholder="What do they need?"
                  value={newRequest.summary}
                  onChange={(e) => setNewRequest(prev => ({ ...prev, summary: e.target.value }))}
                  rows={2}
                  data-testid="textarea-summary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority (optional)</Label>
                <Select 
                  value={newRequest.priority} 
                  onValueChange={(v) => setNewRequest(prev => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue placeholder="Not specified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="soon">Soon (within a week)</SelectItem>
                    <SelectItem value="urgent">Urgent (within 24-48h)</SelectItem>
                    <SelectItem value="emergency">Emergency (now)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={!newRequest.contact_channel_value.trim() || createMutation.isPending} data-testid="button-submit">
                  {createMutation.isPending ? 'Adding...' : 'Add Request'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start flex-wrap gap-1">
          <TabsTrigger value="new" data-testid="tab-new">
            New {stats?.new ? `(${stats.new})` : ''}
          </TabsTrigger>
          <TabsTrigger value="contacted" data-testid="tab-contacted">
            Contacted {stats?.contacted ? `(${stats.contacted})` : ''}
          </TabsTrigger>
          <TabsTrigger value="quoted" data-testid="tab-quoted">
            Quoted {stats?.quoted ? `(${stats.quoted})` : ''}
          </TabsTrigger>
          <TabsTrigger value="converted" data-testid="tab-converted">
            Converted {stats?.converted ? `(${stats.converted})` : ''}
          </TabsTrigger>
          <TabsTrigger value="closed" data-testid="tab-closed">
            Closed {stats?.closed ? `(${stats.closed})` : ''}
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="loading-indicator">Loading...</div>
          ) : workRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground" data-testid="text-empty-state">
                  No work requests {activeTab !== 'all' ? `with status "${activeTab}"` : ''} found
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {workRequests.map((request) => {
                const channelType = request.contact_channel_type as keyof typeof CHANNEL_ICONS;
                const ChannelIcon = CHANNEL_ICONS[channelType] || MessageCircle;
                const statusConfig = STATUS_CONFIG[request.status];
                const priorityConfig = request.priority ? PRIORITY_CONFIG[request.priority] : null;
                const contactName = request.contact_first_name 
                  ? `${request.contact_first_name} ${request.contact_last_name || ''}`.trim() 
                  : null;
                
                return (
                  <Link key={request.id} to={`/app/intake/work-requests/${request.id}`}>
                    <Card className="hover-elevate cursor-pointer" data-testid={`card-request-${request.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="p-2 rounded-md bg-muted">
                              <ChannelIcon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs text-muted-foreground" data-testid={`text-ref-${request.id}`}>
                                  WR-{request.id.slice(0, 8).toUpperCase()}
                                </span>
                                <Badge className={statusConfig.color} data-testid={`badge-status-${request.id}`}>
                                  {statusConfig.label}
                                </Badge>
                                {priorityConfig && (
                                  <Badge className={priorityConfig.color} data-testid={`badge-priority-${request.id}`}>
                                    {priorityConfig.label}
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium truncate mt-1" data-testid={`text-contact-${request.id}`}>
                                {contactName || request.contact_channel_value}
                              </p>
                              {(request.summary || request.description) && (
                                <p className="text-sm text-muted-foreground truncate mt-0.5" data-testid={`text-description-${request.id}`}>
                                  {request.summary || request.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span data-testid={`text-time-${request.id}`}>{formatDate(request.created_at)}</span>
                            </div>
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
