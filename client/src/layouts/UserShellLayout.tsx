/**
 * USER SHELL LAYOUT
 * 
 * Phase 2C-15B: Layout for users with no tenant context selected.
 * 
 * This layout is shown when:
 * - User is authenticated but has no tenant selected
 * - User is impersonating another user but hasn't picked a tenant yet
 * 
 * Features:
 * - Shows impersonation banner if active
 * - Displays "Choose a Place" panel with membership list
 * - Provides "Enter" buttons to set tenant context
 * 
 * NON-NEGOTIABLES:
 * - Does NOT force redirect to /app/select-tenant
 * - Tenant selection is a user action, not a router mandate
 */

import { useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, ArrowRight, User, Loader2 } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';

interface TenantMembership {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string | null;
  tenant_type?: string;
  role: string;
}

export function UserShellLayout() {
  const navigate = useNavigate();
  const { impersonation, token, refreshSession, logout } = useAuth();
  const { memberships: tenantMemberships, loading } = useTenant();
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isImpersonating = impersonation.active;
  const targetUser = impersonation.target_user;

  async function handleEnterTenant(tenantId: string) {
    setSelecting(tenantId);
    setError(null);

    try {
      // Use the appropriate endpoint based on impersonation state
      const endpoint = isImpersonating 
        ? '/api/admin/impersonation/set-tenant'
        : '/api/me/switch-tenant';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tenant_id: tenantId }),
      });

      const data = await res.json();

      if (data.ok) {
        // Clear query cache and refresh session
        queryClient.clear();
        await refreshSession();
        // Navigate to dashboard
        navigate('/app/dashboard');
      } else {
        setError(data.error || 'Failed to enter tenant');
      }
    } catch (err) {
      console.error('Failed to set tenant:', err);
      setError('Failed to enter tenant');
    } finally {
      setSelecting(null);
    }
  }

  async function handleBackToPlatform() {
    if (isImpersonating) {
      try {
        await fetch('/api/admin/impersonation/stop', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        queryClient.clear();
        await refreshSession();
        navigate('/app/platform');
      } catch (err) {
        console.error('Failed to stop impersonation:', err);
      }
    } else {
      navigate('/app/platform');
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  // Cast to our expected type
  const memberships = tenantMemberships as unknown as TenantMembership[];

  return (
    <div className="min-h-screen bg-background" data-testid="user-shell-layout">
      {/* Simple header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Community Canvas</span>
        </div>
        <div className="flex items-center gap-4">
          {isImpersonating && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
              Impersonating: {targetUser?.display_name || targetUser?.email}
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto py-12 px-4">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                {isImpersonating ? (
                  <User className="h-8 w-8 text-primary" />
                ) : (
                  <Building2 className="h-8 w-8 text-primary" />
                )}
              </div>
            </div>
            <CardTitle data-testid="text-user-shell-title">
              {isImpersonating ? 'Choose a Place' : 'Your Places'}
            </CardTitle>
            <CardDescription>
              {isImpersonating 
                ? `Select which organization to view as ${targetUser?.display_name || targetUser?.email}`
                : 'Select an organization to continue'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading...</span>
              </div>
            ) : error ? (
              <div className="text-center py-4">
                <p className="text-destructive text-sm mb-4">{error}</p>
              </div>
            ) : memberships.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2">No places yet</p>
                <p className="text-sm text-muted-foreground">
                  {isImpersonating 
                    ? 'This user has no organization memberships.'
                    : 'You don\'t have access to any organizations yet.'}
                </p>
                {isImpersonating && (
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={handleBackToPlatform}
                    data-testid="button-back-to-platform"
                  >
                    Back to Platform
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {memberships.map((m) => (
                    <Button
                      key={m.tenant_id}
                      variant="outline"
                      className="w-full justify-between h-auto py-3 px-4 hover-elevate"
                      onClick={() => handleEnterTenant(m.tenant_id)}
                      disabled={!!selecting}
                      data-testid={`button-enter-tenant-${m.tenant_id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <div className="text-left">
                          <div className="font-medium">{m.tenant_name}</div>
                          {m.tenant_slug && (
                            <div className="text-xs text-muted-foreground">/{m.tenant_slug}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize text-xs">
                          {m.role.replace(/_/g, ' ')}
                        </Badge>
                        {selecting === m.tenant_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </Button>
                  ))}
                </div>

                {isImpersonating && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={handleBackToPlatform}
                      data-testid="button-cancel-impersonation"
                    >
                      Cancel and return to Platform
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Outlet for any nested routes */}
      <Outlet />
    </div>
  );
}

export default UserShellLayout;
