/**
 * IMPERSONATION CONSOLE
 * 
 * Platform admin page to start/stop user impersonation sessions.
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Search users by email/name
 * 2. Start impersonation for a specific user (with tenant selection if multiple)
 * 3. Stop impersonation returns to this console
 * 4. Show security notice and audit log warning
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Search, 
  AlertTriangle, 
  UserCheck, 
  LogOut, 
  Shield, 
  User,
  Building2,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface UserMembership {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: string;
  title?: string;
}

interface SearchUser {
  id: string;
  email: string;
  displayName: string;
  givenName: string | null;
  familyName: string | null;
  isPlatformAdmin: boolean;
  status: string;
  lastLoginAt: string | null;
  memberships: UserMembership[];
}

interface ImpersonationStatus {
  ok: boolean;
  is_impersonating: boolean;
  impersonated_user_id?: string;
  impersonated_user_email?: string;
  impersonated_user_name?: string;
  tenant_id?: string;
  tenant_name?: string;
  tenant_role?: string;
  expires_at?: string;
}

export function ImpersonationConsole(): React.ReactElement {
  const navigate = useNavigate();
  const { refreshSession, impersonation, token } = useAuth();
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<ImpersonationStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [showTenantPicker, setShowTenantPicker] = useState(false);

  const getAuthHeaders = useCallback(() => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/impersonation/status', {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (data.ok !== false) {
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch impersonation status:', err);
    } finally {
      setStatusLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setUsers([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/impersonation/users?query=${encodeURIComponent(query)}&limit=20`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      
      if (data.ok) {
        setUsers(data.users || []);
      } else {
        setError(data.error || 'Failed to search users');
        setUsers([]);
      }
    } catch (err) {
      console.error('Failed to search users:', err);
      setError('Failed to search users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchTerm.length >= 2) {
        searchUsers(searchTerm);
      } else {
        setUsers([]);
      }
    }, 300);
    
    return () => clearTimeout(debounce);
  }, [searchTerm, searchUsers]);

  async function handleStartImpersonation(userId: string, tenantId?: string) {
    setStarting(userId);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/impersonation/start', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          user_id: userId,
          tenant_id: tenantId,
          reason: 'Platform admin support',
        }),
      });
      
      const data = await response.json();
      
      if (data.ok) {
        setShowOverlay(true);
        queryClient.clear();
        const refreshed = await refreshSession();
        if (refreshed) {
          await fetchStatus();
          // Phase 2C-13.5: Navigate to select-tenant if no tenant was specified
          // (impersonation now starts with tenant=null by default)
          if (tenantId) {
            navigate('/app');
          } else {
            navigate('/app/select-tenant');
          }
        } else {
          setError('Failed to refresh session after starting impersonation');
        }
        setShowOverlay(false);
      } else {
        setError(data.error || 'Failed to start impersonation');
      }
    } catch (err) {
      console.error('Failed to start impersonation:', err);
      setError('Failed to start impersonation');
    } finally {
      setStarting(null);
    }
  }

  async function handleStopImpersonation() {
    setStopping(true);
    setError(null);
    setShowOverlay(true);
    
    try {
      const response = await fetch('/api/admin/impersonation/stop', {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      
      const data = await response.json();
      
      if (data.ok) {
        queryClient.clear();
        const refreshed = await refreshSession();
        if (refreshed) {
          await fetchStatus();
        } else {
          setError('Failed to refresh session after stopping impersonation');
        }
      } else {
        setError(data.error || 'Failed to stop impersonation');
      }
    } catch (err) {
      console.error('Failed to stop impersonation:', err);
      setError('Failed to stop impersonation');
    } finally {
      setStopping(false);
      setShowOverlay(false);
    }
  }

  function handleSelectTenant(tenantId: string) {
    if (selectedUser) {
      setShowTenantPicker(false);
      handleStartImpersonation(selectedUser.id, tenantId);
    }
  }

  return (
    <>
      {showOverlay && (
        <div 
          className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center"
          data-testid="impersonation-overlay"
        >
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-lg font-medium">Switching identity...</p>
          </div>
        </div>
      )}
      <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">User Impersonation</h1>
        <p className="text-muted-foreground">
          Temporarily access user accounts for support and debugging
        </p>
      </div>

      {status?.is_impersonating && (
        <Alert className="border-amber-500 bg-amber-500/10">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <AlertTitle className="text-amber-400">Active Impersonation Session</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-amber-300/80">
                  Currently impersonating: <strong>{status.impersonated_user_name}</strong> ({status.impersonated_user_email})
                </p>
                {status.tenant_name && (
                  <p className="text-amber-300/60 text-sm">
                    Tenant: {status.tenant_name} ({status.tenant_role})
                  </p>
                )}
                {status.expires_at && (
                  <p className="text-amber-300/60 text-sm flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Expires: {new Date(status.expires_at).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <Button
                onClick={handleStopImpersonation}
                disabled={stopping}
                variant="outline"
                className="border-amber-500 text-amber-400 hover:bg-amber-500/20"
                data-testid="button-stop-impersonation"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {stopping ? 'Stopping...' : 'Stop Impersonation'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Notice
          </CardTitle>
          <CardDescription>
            All impersonation sessions are logged with full audit trail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Admin identity and IP address</li>
            <li>Target user and tenant</li>
            <li>Session start/stop times</li>
            <li>All actions performed during impersonation</li>
          </ul>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Users
          </CardTitle>
          <CardDescription>
            Search by email or name to find a user to impersonate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-user-search"
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {!loading && users.length > 0 && (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate"
                  data-testid={`user-row-${user.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {user.displayName}
                        {user.isPlatformAdmin && (
                          <Badge variant="secondary" className="text-xs">
                            Platform Admin
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                      {user.memberships && user.memberships.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {user.memberships.length} tenant{user.memberships.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleStartImpersonation(user.id)}
                    disabled={starting === user.id || (status?.is_impersonating ?? false)}
                    size="sm"
                    data-testid={`button-impersonate-${user.id}`}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    {starting === user.id ? 'Starting...' : 'Impersonate'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!loading && searchTerm.length >= 2 && users.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching "{searchTerm}"
            </div>
          )}

          {!loading && searchTerm.length < 2 && (
            <div className="text-center py-8 text-muted-foreground">
              Enter at least 2 characters to search
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showTenantPicker} onOpenChange={setShowTenantPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Tenant Context</DialogTitle>
            <DialogDescription>
              {selectedUser?.displayName} has multiple tenant memberships. Select which tenant context to use.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {selectedUser?.memberships?.map((m) => (
              <Button
                key={m.tenant_id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleSelectTenant(m.tenant_id)}
                data-testid={`button-select-tenant-${m.tenant_slug}`}
              >
                <Building2 className="h-4 w-4 mr-2" />
                <span className="flex-1 text-left">{m.tenant_name}</span>
                <Badge variant="secondary" className="ml-2">{m.role}</Badge>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTenantPicker(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
