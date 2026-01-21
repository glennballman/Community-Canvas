import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Save, Plus, Trash2, ExternalLink, GripVertical,
  Layout, Palette, Link2, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface NavLink {
  label: string;
  url: string;
  isExternal: boolean;
}

interface PortalUISettings {
  logo_url?: string;
  primary_color?: string;
  nav_mode?: 'top' | 'left';
  nav_links?: NavLink[];
  show_powered_by?: boolean;
  external_site_url?: string;
  external_site_name?: string;
}

interface Zone {
  id: string;
  key: string;
  name: string;
  badgeLabelResident: string | null;
}

interface PortalResponse {
  ok: boolean;
  portal: {
    id: string;
    slug: string;
    name: string;
    defaultZoneId?: string | null;
    settings: {
      ui?: PortalUISettings;
    };
  };
}

const DEFAULT_NAV_LINKS: NavLink[] = [
  { label: 'Jobs', url: '/jobs', isExternal: false },
];

export default function PortalAppearancePage() {
  const { portalId } = useParams<{ portalId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [navMode, setNavMode] = useState<'top' | 'left'>('top');
  const [navLinks, setNavLinks] = useState<NavLink[]>(DEFAULT_NAV_LINKS);
  const [showPoweredBy, setShowPoweredBy] = useState(true);
  const [externalSiteUrl, setExternalSiteUrl] = useState('');
  const [externalSiteName, setExternalSiteName] = useState('');
  const [defaultZoneId, setDefaultZoneId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PortalResponse>({
    queryKey: ['/api/p2/admin/portals', portalId],
    queryFn: async () => {
      const res = await fetch(`/api/p2/admin/portals/${portalId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch portal');
      return res.json();
    },
    enabled: !!portalId,
  });

  const { data: zonesData } = useQuery<{ ok: boolean; zones: Zone[] }>({
    queryKey: ['/api/p2/admin/portals', portalId, 'zones'],
    queryFn: async () => {
      const res = await fetch(`/api/p2/admin/portals/${portalId}/zones`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch zones');
      return res.json();
    },
    enabled: !!portalId,
  });

  const zones = zonesData?.zones || [];

  useEffect(() => {
    if (data?.portal) {
      setDefaultZoneId(data.portal.defaultZoneId || null);
    }
    if (data?.portal?.settings?.ui) {
      const ui = data.portal.settings.ui;
      setLogoUrl(ui.logo_url || '');
      setPrimaryColor(ui.primary_color || '#3b82f6');
      setNavMode(ui.nav_mode || 'top');
      setNavLinks(ui.nav_links?.length ? ui.nav_links : DEFAULT_NAV_LINKS);
      setShowPoweredBy(ui.show_powered_by !== false);
      setExternalSiteUrl(ui.external_site_url || '');
      setExternalSiteName(ui.external_site_name || '');
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (settings: PortalUISettings) => {
      const res = await apiRequest('PATCH', `/api/p2/admin/portals/${portalId}/appearance`, settings);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/portals', portalId] });
      toast({ title: 'Appearance settings saved' });
    },
    onError: () => {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    },
  });

  const defaultZoneMutation = useMutation({
    mutationFn: async (zoneId: string | null) => {
      const res = await apiRequest('PATCH', `/api/p2/admin/portals/${portalId}/default-zone`, {
        default_zone_id: zoneId,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/portals', portalId] });
      toast({ title: 'Default zone updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update default zone', variant: 'destructive' });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      logo_url: logoUrl || undefined,
      primary_color: primaryColor,
      nav_mode: navMode,
      nav_links: navLinks,
      show_powered_by: showPoweredBy,
      external_site_url: externalSiteUrl || undefined,
      external_site_name: externalSiteName || undefined,
    });
  };

  const handleDefaultZoneChange = (zoneId: string) => {
    const actualZoneId = zoneId === 'none' ? null : zoneId;
    setDefaultZoneId(actualZoneId);
    defaultZoneMutation.mutate(actualZoneId);
  };

  const addNavLink = () => {
    if (navLinks.length >= 7) {
      toast({ title: 'Maximum 7 navigation links allowed', variant: 'destructive' });
      return;
    }
    setNavLinks([...navLinks, { label: '', url: '', isExternal: false }]);
  };

  const updateNavLink = (index: number, field: keyof NavLink, value: string | boolean) => {
    const updated = [...navLinks];
    updated[index] = { ...updated[index], [field]: value };
    setNavLinks(updated);
  };

  const removeNavLink = (index: number) => {
    setNavLinks(navLinks.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto" data-testid="page-portal-appearance">
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(-1)}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Portal Appearance</h1>
          <p className="text-muted-foreground">{data?.portal?.name || 'Configure portal appearance'}</p>
        </div>
      </div>

      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList>
          <TabsTrigger value="branding" data-testid="tab-branding">
            <Palette className="h-4 w-4 mr-2" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="navigation" data-testid="tab-navigation">
            <Layout className="h-4 w-4 mr-2" />
            Navigation
          </TabsTrigger>
          <TabsTrigger value="links" data-testid="tab-links">
            <Link2 className="h-4 w-4 mr-2" />
            External Links
          </TabsTrigger>
          <TabsTrigger value="operations" data-testid="tab-operations">
            <MapPin className="h-4 w-4 mr-2" />
            Operations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Customize your portal's visual identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  data-testid="input-logo-url"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended size: 200x50 pixels, PNG or SVG format
                </p>
                {logoUrl && (
                  <div className="mt-2 p-4 border rounded-lg bg-muted/30">
                    <img 
                      src={logoUrl} 
                      alt="Logo preview" 
                      className="h-10 w-auto"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    id="primaryColor"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    className="w-12 h-10 rounded border cursor-pointer"
                    data-testid="input-primary-color"
                  />
                  <Input
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    placeholder="#3b82f6"
                    className="max-w-32"
                  />
                  <div 
                    className="h-10 flex-1 rounded border"
                    style={{ backgroundColor: primaryColor }}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="poweredBy">Show "Powered by Community Canvas"</Label>
                  <p className="text-xs text-muted-foreground">
                    Display footer attribution
                  </p>
                </div>
                <Switch
                  id="poweredBy"
                  checked={showPoweredBy}
                  onCheckedChange={setShowPoweredBy}
                  data-testid="switch-powered-by"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="navigation">
          <Card>
            <CardHeader>
              <CardTitle>Navigation Layout</CardTitle>
              <CardDescription>Configure how navigation appears</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Navigation Mode</Label>
                <Select value={navMode} onValueChange={(v: 'top' | 'left') => setNavMode(v)}>
                  <SelectTrigger data-testid="select-nav-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top">Top Navigation (Horizontal)</SelectItem>
                    <SelectItem value="left">Left Sidebar (Vertical)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Navigation Links</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={addNavLink}
                    disabled={navLinks.length >= 7}
                    data-testid="button-add-link"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Link
                  </Button>
                </div>

                <div className="space-y-3">
                  {navLinks.map((link, index) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30"
                      data-testid={`nav-link-row-${index}`}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      
                      <Input
                        value={link.label}
                        onChange={e => updateNavLink(index, 'label', e.target.value)}
                        placeholder="Label"
                        className="max-w-32"
                        data-testid={`input-link-label-${index}`}
                      />
                      
                      <Input
                        value={link.url}
                        onChange={e => updateNavLink(index, 'url', e.target.value)}
                        placeholder={link.isExternal ? "https://..." : "/path"}
                        className="flex-1"
                        data-testid={`input-link-url-${index}`}
                      />

                      <div className="flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">External</Label>
                        <Switch
                          checked={link.isExternal}
                          onCheckedChange={v => updateNavLink(index, 'isExternal', v)}
                          data-testid={`switch-external-${index}`}
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeNavLink(index)}
                        data-testid={`button-remove-link-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  Internal links start with "/" (e.g., /jobs). External links require full URL.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links">
          <Card>
            <CardHeader>
              <CardTitle>External Site Link</CardTitle>
              <CardDescription>Link back to your main website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="externalSiteUrl">Main Site URL</Label>
                <Input
                  id="externalSiteUrl"
                  value={externalSiteUrl}
                  onChange={e => setExternalSiteUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  data-testid="input-external-url"
                />
                <p className="text-xs text-muted-foreground">
                  Shows a "Back to site" link in navigation
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="externalSiteName">Site Name</Label>
                <Input
                  id="externalSiteName"
                  value={externalSiteName}
                  onChange={e => setExternalSiteName(e.target.value)}
                  placeholder="Your Website"
                  data-testid="input-external-name"
                />
                <p className="text-xs text-muted-foreground">
                  Display name for the external link (e.g., "Back to Your Website")
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations">
          <Card>
            <CardHeader>
              <CardTitle>Operations</CardTitle>
              <CardDescription>Configure operational defaults for this portal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="defaultZone">Default Zone</Label>
                <Select 
                  value={defaultZoneId || 'none'} 
                  onValueChange={handleDefaultZoneChange}
                  disabled={defaultZoneMutation.isPending}
                >
                  <SelectTrigger className="w-64" data-testid="select-default-zone">
                    <SelectValue placeholder="Select default zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No default zone</SelectItem>
                    {zones.map(zone => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.badgeLabelResident || zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  New N3 Service Runs and Work Requests assigned to this portal will automatically use this zone if no other zone is specified.
                </p>
                {zones.length === 0 && (
                  <p className="text-xs text-amber-600">
                    No zones configured for this portal. Create zones to enable zone defaulting.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 mt-6">
        <Button 
          variant="outline" 
          onClick={() => navigate(-1)}
          data-testid="button-cancel"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          disabled={saveMutation.isPending}
          data-testid="button-save"
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
