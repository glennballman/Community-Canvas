import { useState } from 'react';
import { useHostAuth, ProtectedHostRoute } from '@/contexts/HostAuthContext';
import { HostLayout } from '@/components/HostLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

function SettingsContent() {
  const { host } = useHostAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  const [profile, setProfile] = useState({
    businessName: '',
    contactName: '',
    phone: '',
    email: host?.email || ''
  });

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const handleSaveProfile = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    toast({ title: 'Profile updated' });
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    toast({ title: 'Password changed' });
    setPasswords({ current: '', new: '', confirm: '' });
    setSaving(false);
  };

  return (
    <HostLayout>
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6" data-testid="text-settings-title">Account Settings</h1>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input
                  value={profile.businessName}
                  onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                  placeholder="Your business name"
                  data-testid="input-business-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  value={profile.contactName}
                  onChange={(e) => setProfile({ ...profile, contactName: e.target.value })}
                  placeholder="Your name"
                  data-testid="input-contact-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  data-testid="input-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={profile.email}
                  disabled
                  className="bg-muted"
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving} data-testid="button-save-profile">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                  data-testid="input-current-password"
                />
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={passwords.new}
                  onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={passwords.confirm}
                  onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  data-testid="input-confirm-password"
                />
              </div>
              <Button onClick={handleChangePassword} disabled={saving} data-testid="button-change-password">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Change Password
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" data-testid="button-delete-account">
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </HostLayout>
  );
}

export default function HostSettings() {
  return (
    <ProtectedHostRoute>
      <SettingsContent />
    </ProtectedHostRoute>
  );
}
