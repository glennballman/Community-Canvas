/**
 * SelectTenantPage - Explicit tenant selection for impersonation
 * 
 * Phase 2C-13.5: Impersonation Semantics Correction
 * 
 * When impersonating a user, this page allows explicit selection
 * of which tenant context to operate under.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, UserCircle, ArrowLeft, Loader2 } from 'lucide-react';

interface TenantMembership {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string | null;
  role: string;
}

export default function SelectTenantPage() {
  const navigate = useNavigate();
  const { impersonation, refreshSession, token } = useAuth();
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMemberships = useCallback(async () => {
    if (!impersonation.active || !impersonation.target_user) {
      navigate('/app/platform');
      return;
    }

    try {
      // Fetch impersonation status which now includes memberships
      const res = await fetch('/api/admin/impersonation/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      const data = await res.json();
      
      if (!data.ok || !data.is_impersonating) {
        navigate('/app/platform');
        return;
      }

      // Status endpoint now includes memberships
      if (data.memberships && Array.isArray(data.memberships)) {
        setMemberships(data.memberships);
      }
    } catch (err) {
      console.error('Failed to fetch memberships:', err);
      setError('Failed to load tenant memberships');
    } finally {
      setLoading(false);
    }
  }, [impersonation, navigate, token]);

  useEffect(() => {
    fetchMemberships();
  }, [fetchMemberships]);

  async function handleSelectTenant(tenantId: string) {
    setSelecting(tenantId);
    setError(null);

    try {
      const res = await fetch('/api/admin/impersonation/set-tenant', {
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
        await refreshSession();
        navigate('/app');
      } else {
        setError(data.error || 'Failed to set tenant');
      }
    } catch (err) {
      console.error('Failed to set tenant:', err);
      setError('Failed to set tenant');
    } finally {
      setSelecting(null);
    }
  }

  async function handleBackToPlatform() {
    try {
      await fetch('/api/admin/impersonation/stop', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      await refreshSession();
      navigate('/app/platform');
    } catch (err) {
      console.error('Failed to stop impersonation:', err);
    }
  }

  // If not impersonating at all, redirect
  if (!impersonation.active) {
    return null;
  }

  // If already has tenant, redirect to app
  if (impersonation.tenant) {
    navigate('/app');
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <UserCircle className="h-8 w-8 text-muted-foreground" />
            <div>
              <CardTitle data-testid="text-impersonating-title">Select Tenant Context</CardTitle>
              <CardDescription>
                Impersonating: <strong>{impersonation.target_user?.display_name || impersonation.target_user?.email}</strong>
              </CardDescription>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Choose which tenant you want to view as this user. This determines which
            data and features will be accessible.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading memberships...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={handleBackToPlatform} data-testid="button-back-to-platform-error">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Platform
              </Button>
            </div>
          ) : memberships.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                This user has no tenant memberships.
              </p>
              <Button variant="outline" onClick={handleBackToPlatform} data-testid="button-back-to-platform-no-tenants">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Platform
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {memberships.map((m) => (
                  <Button
                    key={m.tenant_id}
                    variant="outline"
                    className="w-full justify-between h-auto py-3"
                    onClick={() => handleSelectTenant(m.tenant_id)}
                    disabled={!!selecting}
                    data-testid={`button-select-tenant-${m.tenant_id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div className="text-left">
                        <div className="font-medium">{m.tenant_name}</div>
                        {m.tenant_slug && (
                          <div className="text-xs text-muted-foreground">/{m.tenant_slug}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {m.role.replace(/_/g, ' ')}
                      </Badge>
                      {selecting === m.tenant_id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </Button>
                ))}
              </div>
              <div className="pt-4 border-t">
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={handleBackToPlatform}
                  data-testid="button-cancel-impersonation"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Cancel and return to Platform
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
