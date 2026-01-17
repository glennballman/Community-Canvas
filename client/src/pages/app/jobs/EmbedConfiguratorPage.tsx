import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Plus, Copy, Code, Globe, Shield, Trash2 } from 'lucide-react';

interface EmbedSurface {
  id: string;
  label: string;
  allowed_domains: string[];
  is_active: boolean;
  created_at: string;
  active_jobs: number;
}

interface SurfacesResponse {
  ok: boolean;
  surfaces: EmbedSurface[];
}

export default function EmbedConfiguratorPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newSurfaceLabel, setNewSurfaceLabel] = useState('');
  const [newSurfaceDomains, setNewSurfaceDomains] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [editingSurface, setEditingSurface] = useState<EmbedSurface | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDomains, setEditDomains] = useState('');
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [selectedSurfaceForCode, setSelectedSurfaceForCode] = useState<EmbedSurface | null>(null);

  const { data, isLoading } = useQuery<SurfacesResponse>({
    queryKey: ['/api/p2/embeds/surfaces'],
    queryFn: async () => {
      const res = await fetch('/api/p2/embeds/surfaces');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { label: string; allowedDomains: string[] }) => {
      const res = await apiRequest('POST', '/api/p2/embeds/surfaces', data);
      return res.json();
    },
    onSuccess: (result) => {
      if (result.embedKey) {
        setCreatedKey(result.embedKey);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/p2/embeds/surfaces'] });
      toast({ title: 'Embed surface created' });
    },
    onError: () => {
      toast({ title: 'Failed to create embed surface', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest('PATCH', `/api/p2/embeds/surfaces/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/embeds/surfaces'] });
      toast({ title: 'Embed surface updated' });
      setEditingSurface(null);
    },
    onError: () => {
      toast({ title: 'Failed to update embed surface', variant: 'destructive' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest('PATCH', `/api/p2/embeds/surfaces/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/embeds/surfaces'] });
    },
    onError: () => {
      toast({ title: 'Failed to update surface status', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/p2/embeds/surfaces/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/embeds/surfaces'] });
      toast({ title: 'Embed surface deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete embed surface', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    const domains = newSurfaceDomains
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0);
    createMutation.mutate({ label: newSurfaceLabel, allowedDomains: domains });
  };

  const handleUpdate = () => {
    if (!editingSurface) return;
    const domains = editDomains
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0);
    updateMutation.mutate({
      id: editingSurface.id,
      data: { label: editLabel, allowedDomains: domains },
    });
  };

  const openEditDialog = (surface: EmbedSurface) => {
    setEditingSurface(surface);
    setEditLabel(surface.label);
    setEditDomains(surface.allowed_domains.join('\n'));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const generateEmbedCode = (embedKey: string) => {
    return `<!-- Community Canvas Job Widget -->
<div id="cc-jobs-widget" data-embed-key="${embedKey}"></div>
<script src="${window.location.origin}/embed/jobs-widget.js" async></script>`;
  };

  const surfaces = data?.surfaces || [];

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/jobs')} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Embed Configurator</h1>
          <p className="text-muted-foreground">Create widgets to embed job listings on external websites</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-surface">
          <Plus className="h-4 w-4 mr-2" />
          Create Embed Surface
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : surfaces.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Code className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Embed Surfaces</h3>
            <p className="text-muted-foreground mb-4">
              Create an embed surface to generate widgets for external websites
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-surface-empty">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Embed
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {surfaces.map((surface) => (
            <Card key={surface.id} data-testid={`card-surface-${surface.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{surface.label}</CardTitle>
                    <Badge variant={surface.is_active ? 'default' : 'secondary'}>
                      {surface.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardDescription>
                    {surface.active_jobs} active job{surface.active_jobs !== 1 ? 's' : ''} published
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={surface.is_active}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: surface.id, isActive: checked })
                    }
                    data-testid={`switch-active-${surface.id}`}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm text-muted-foreground flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Allowed Domains
                    </Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {surface.allowed_domains.length === 0 ? (
                        <span className="text-sm text-muted-foreground">All domains allowed</span>
                      ) : (
                        surface.allowed_domains.map((domain, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            {domain}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(surface)}
                      data-testid={`button-edit-${surface.id}`}
                    >
                      Edit Settings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSurfaceForCode(surface);
                        setCodeDialogOpen(true);
                      }}
                      data-testid={`button-get-code-${surface.id}`}
                    >
                      <Code className="h-4 w-4 mr-1" />
                      Get Embed Code
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this embed surface?')) {
                          deleteMutation.mutate(surface.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${surface.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Embed Surface</DialogTitle>
            <DialogDescription>
              Create a new embed surface to publish jobs to external websites
            </DialogDescription>
          </DialogHeader>
          {createdKey ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  Embed Key Created
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                  Save this key now. It cannot be retrieved again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-white dark:bg-black rounded text-xs break-all">
                    {createdKey}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(createdKey)}
                    data-testid="button-copy-key"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setCreatedKey(null);
                    setCreateDialogOpen(false);
                    setNewSurfaceLabel('');
                    setNewSurfaceDomains('');
                  }}
                  data-testid="button-done-create"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="label">Surface Label</Label>
                  <Input
                    id="label"
                    value={newSurfaceLabel}
                    onChange={(e) => setNewSurfaceLabel(e.target.value)}
                    placeholder="e.g., Company Website Jobs"
                    data-testid="input-surface-label"
                  />
                </div>
                <div>
                  <Label htmlFor="domains">Allowed Domains (one per line)</Label>
                  <Textarea
                    id="domains"
                    value={newSurfaceDomains}
                    onChange={(e) => setNewSurfaceDomains(e.target.value)}
                    placeholder="example.com&#10;*.example.com&#10;Leave empty to allow all"
                    rows={4}
                    data-testid="textarea-allowed-domains"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Use *.domain.com for wildcard subdomains. Leave empty to allow all domains.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newSurfaceLabel.trim() || createMutation.isPending}
                  data-testid="button-confirm-create"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingSurface} onOpenChange={(open) => !open && setEditingSurface(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Embed Surface</DialogTitle>
            <DialogDescription>
              Update the settings for this embed surface
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-label">Surface Label</Label>
              <Input
                id="edit-label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                data-testid="input-edit-label"
              />
            </div>
            <div>
              <Label htmlFor="edit-domains">Allowed Domains (one per line)</Label>
              <Textarea
                id="edit-domains"
                value={editDomains}
                onChange={(e) => setEditDomains(e.target.value)}
                placeholder="example.com&#10;*.example.com"
                rows={4}
                data-testid="textarea-edit-domains"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingSurface(null)}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!editLabel.trim() || updateMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={codeDialogOpen} onOpenChange={setCodeDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Embed Code</DialogTitle>
            <DialogDescription>
              Copy this code and paste it into your website where you want the job widget to appear
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground mb-2">
                You'll need to provide your embed key to generate the code. If you don't have it saved,
                you may need to create a new embed surface.
              </p>
            </div>
            <div>
              <Label htmlFor="embed-key-input">Embed Key</Label>
              <Input
                id="embed-key-input"
                placeholder="Paste your embed key here"
                data-testid="input-embed-key"
                onChange={(e) => {
                  const key = e.target.value;
                  const codeEl = document.getElementById('embed-code-preview');
                  if (codeEl && key) {
                    codeEl.textContent = generateEmbedCode(key);
                  }
                }}
              />
            </div>
            <div>
              <Label>Generated Code</Label>
              <pre
                id="embed-code-preview"
                className="p-4 bg-black text-green-400 rounded-md text-xs overflow-x-auto"
              >
                {`<!-- Enter your embed key above to generate the code -->`}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCodeDialogOpen(false)} data-testid="button-close-code">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
