/**
 * FOUNDER ORGANIZATIONS PAGE
 * 
 * Lists all organizations the founder owns/manages.
 * Aggregate view in Founder Solo mode.
 */

import { Link } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, ArrowRight, Users } from 'lucide-react';

const TYPE_ICONS: Record<string, string> = {
  community: '🏔️',
  government: '🏛️',
  business: '🏢',
  individual: '👤',
};

export default function FounderOrganizationsPage() {
  const { memberships, switchTenant } = useTenant();

  const communities = memberships.filter(
    m => m.tenant_type === 'community' || m.tenant_type === 'government'
  );
  const businesses = memberships.filter(m => m.tenant_type === 'business');

  const handleSelectTenant = (tenantId: string) => {
    switchTenant(tenantId);
  };

  return (
    <div className="p-6 space-y-6" data-testid="founder-organizations-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-page-title">
            All Organizations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {memberships.length} organizations you manage
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberships.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Communities</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{communities.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Businesses</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{businesses.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Organizations List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Organizations</CardTitle>
          <CardDescription>
            Click to enter an organization's dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {memberships.map((m) => (
            <button
              key={m.tenant_id}
              onClick={() => handleSelectTenant(m.tenant_id)}
              className="w-full flex items-center justify-between p-4 rounded-lg border hover-elevate text-left"
              data-testid={`button-org-${m.tenant_id}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{TYPE_ICONS[m.tenant_type] || '🏢'}</span>
                <div>
                  <div className="font-medium">{m.tenant_name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">{m.role}</Badge>
                    <span className="capitalize">{m.tenant_type}</span>
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
          {memberships.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No organizations yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
