/**
 * Admin Settings Page - P-UI-17
 * Route: /app/admin/settings
 * 
 * Portal settings and notification preferences
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Settings, Bell, Palette, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PortalSettings {
  id: string;
  portal_id: string;
  branding: {
    primary_color?: string;
    logo_url?: string;
    tagline?: string;
  };
  moderation: {
    require_approval?: boolean;
    auto_publish?: boolean;
  };
  features: {
    jobs_enabled?: boolean;
    listings_enabled?: boolean;
    messaging_enabled?: boolean;
  };
}

interface NotificationPrefs {
  id: string;
  portal_id: string;
  channel: string;
  event_type: string;
  enabled: boolean;
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('portal');

  const { data: settingsData, isLoading: settingsLoading } = useQuery<{ ok: boolean; settings: PortalSettings[]; portals: { id: string; name: string }[] }>({
    queryKey: ['/api/p2/admin/portal-settings'],
  });

  const { data: notifData, isLoading: notifLoading } = useQuery<{ ok: boolean; preferences: NotificationPrefs[] }>({
    queryKey: ['/api/p2/admin/notifications'],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async ({ portalId, branding, moderation, features }: { portalId: string; branding?: Record<string, unknown>; moderation?: Record<string, unknown>; features?: Record<string, unknown> }) => {
      return apiRequest('PATCH', `/api/p2/admin/portal-settings/${portalId}`, { branding, moderation, features });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/portal-settings'] });
      toast({ title: 'Settings saved', description: 'Portal settings have been updated.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateNotifMutation = useMutation({
    mutationFn: async ({ portalId, channel, eventType, enabled }: { portalId: string; channel: string; eventType: string; enabled: boolean }) => {
      return apiRequest('PUT', `/api/p2/admin/notifications`, { portal_id: portalId, channel, event_type: eventType, enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/p2/admin/notifications'] });
      toast({ title: 'Preferences saved' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const settings = settingsData?.settings ?? [];
  const portals = settingsData?.portals ?? [];
  const notifPrefs = notifData?.preferences ?? [];

  const [localSettings, setLocalSettings] = useState<Record<string, PortalSettings>>({});

  const getSettings = (portalId: string): PortalSettings => {
    if (localSettings[portalId]) return localSettings[portalId];
    const found = settings.find(s => s.portal_id === portalId);
    return found || {
      id: '',
      portal_id: portalId,
      branding: {},
      moderation: {},
      features: {},
    };
  };

  const updateLocalSettings = (portalId: string, update: Partial<PortalSettings>) => {
    setLocalSettings(prev => ({
      ...prev,
      [portalId]: { ...getSettings(portalId), ...update },
    }));
  };

  const savePortalSettings = (portalId: string) => {
    const s = getSettings(portalId);
    updateSettingsMutation.mutate({
      portalId,
      branding: s.branding,
      moderation: s.moderation,
      features: s.features,
    });
  };

  const notifEventTypes = ['new_reservation', 'reservation_cancelled', 'payment_received', 'new_member', 'job_posted'];
  const notifChannels = ['email', 'push', 'sms'];

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-settings">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure portal settings and notifications</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="portal" data-testid="tab-portal">
            <Palette className="h-4 w-4 mr-2" />
            Portal Settings
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="portal" className="space-y-4 mt-4">
          {settingsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading settings...</div>
          ) : portals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No portals found for this tenant
              </CardContent>
            </Card>
          ) : (
            portals.map(portal => {
              const s = getSettings(portal.id);
              return (
                <Card key={portal.id} data-testid={`settings-card-${portal.id}`}>
                  <CardHeader>
                    <CardTitle>{portal.name}</CardTitle>
                    <CardDescription>Configure branding, moderation, and features</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">Branding</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`tagline-${portal.id}`}>Tagline</Label>
                          <Input
                            id={`tagline-${portal.id}`}
                            value={s.branding.tagline || ''}
                            onChange={(e) => updateLocalSettings(portal.id, { branding: { ...s.branding, tagline: e.target.value } })}
                            placeholder="Your portal tagline"
                            data-testid={`input-tagline-${portal.id}`}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`primary-color-${portal.id}`}>Primary Color</Label>
                          <Input
                            id={`primary-color-${portal.id}`}
                            type="color"
                            value={s.branding.primary_color || '#3b82f6'}
                            onChange={(e) => updateLocalSettings(portal.id, { branding: { ...s.branding, primary_color: e.target.value } })}
                            className="h-10 w-20"
                            data-testid={`input-color-${portal.id}`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Moderation</h4>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Require Approval</Label>
                          <p className="text-sm text-muted-foreground">New listings require admin approval</p>
                        </div>
                        <Switch
                          checked={s.moderation.require_approval || false}
                          onCheckedChange={(checked) => updateLocalSettings(portal.id, { moderation: { ...s.moderation, require_approval: checked } })}
                          data-testid={`switch-require-approval-${portal.id}`}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Auto-Publish</Label>
                          <p className="text-sm text-muted-foreground">Automatically publish approved content</p>
                        </div>
                        <Switch
                          checked={s.moderation.auto_publish || false}
                          onCheckedChange={(checked) => updateLocalSettings(portal.id, { moderation: { ...s.moderation, auto_publish: checked } })}
                          data-testid={`switch-auto-publish-${portal.id}`}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Features</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <Label>Jobs</Label>
                          <Switch
                            checked={s.features.jobs_enabled ?? true}
                            onCheckedChange={(checked) => updateLocalSettings(portal.id, { features: { ...s.features, jobs_enabled: checked } })}
                            data-testid={`switch-jobs-${portal.id}`}
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <Label>Listings</Label>
                          <Switch
                            checked={s.features.listings_enabled ?? true}
                            onCheckedChange={(checked) => updateLocalSettings(portal.id, { features: { ...s.features, listings_enabled: checked } })}
                            data-testid={`switch-listings-${portal.id}`}
                          />
                        </div>
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                          <Label>Messaging</Label>
                          <Switch
                            checked={s.features.messaging_enabled ?? true}
                            onCheckedChange={(checked) => updateLocalSettings(portal.id, { features: { ...s.features, messaging_enabled: checked } })}
                            data-testid={`switch-messaging-${portal.id}`}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => savePortalSettings(portal.id)}
                        disabled={updateSettingsMutation.isPending}
                        data-testid={`button-save-${portal.id}`}
                      >
                        {updateSettingsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Settings
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4 mt-4">
          {notifLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading notification preferences...</div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you want to be notified for different events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4 pb-2 border-b font-medium text-sm text-muted-foreground">
                    <div>Event</div>
                    {notifChannels.map(ch => (
                      <div key={ch} className="capitalize text-center">{ch}</div>
                    ))}
                  </div>
                  {notifEventTypes.map(eventType => (
                    <div key={eventType} className="grid grid-cols-4 gap-4 items-center">
                      <div className="text-sm capitalize">{eventType.replace(/_/g, ' ')}</div>
                      {notifChannels.map(channel => {
                        const pref = notifPrefs.find(p => p.event_type === eventType && p.channel === channel);
                        const enabled = pref?.enabled ?? false;
                        const portalId = portals[0]?.id || '';
                        return (
                          <div key={channel} className="flex justify-center">
                            <Switch
                              checked={enabled}
                              onCheckedChange={(checked) => updateNotifMutation.mutate({ portalId, channel, eventType, enabled: checked })}
                              data-testid={`notif-${eventType}-${channel}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
