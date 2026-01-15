/**
 * CONTEXT INDICATOR
 * 
 * Shows Portal/Tenant/Circle context in top bar.
 * Uses /api/me/context and switch endpoints.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, Building2, Globe, ChevronDown, X } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface UserContextResponse {
  user: {
    id: string;
    email: string;
    full_name: string;
    is_platform_admin: boolean;
  };
  memberships: Array<{
    tenant_id: string;
    tenant_name: string;
    tenant_slug: string;
    tenant_type: string;
    role: string;
  }>;
  current_tenant_id: string | null;
  current_portal: {
    id: string;
    name: string;
    slug: string;
  } | null;
  current_circle_id: string | null;
  acting_as_circle: boolean;
  current_circle: {
    id: string;
    name: string;
    slug: string;
  } | null;
  is_impersonating: boolean;
  impersonated_tenant: {
    id: string;
    name: string;
    type: string;
    portal_slug?: string | null;
  } | null;
}

interface CirclesResponse {
  circles: Array<{
    id: string;
    name: string;
    slug: string;
    role_name: string;
    role_level: number;
  }>;
}

export function ContextIndicator() {
  const queryClient = useQueryClient();
  const [circleMenuOpen, setCircleMenuOpen] = useState(false);

  const { data: context, isLoading: contextLoading } = useQuery<UserContextResponse>({
    queryKey: ['/api/me/context'],
    staleTime: 30000,
  });

  const { data: circlesData } = useQuery<CirclesResponse>({
    queryKey: ['/api/me/circles'],
    staleTime: 60000,
    enabled: !!context,
  });

  const switchCircleMutation = useMutation({
    mutationFn: async (circleId: string) => {
      return apiRequest('POST', '/api/me/switch-circle', { circle_id: circleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/context'] });
      setCircleMenuOpen(false);
    },
  });

  const clearCircleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/me/clear-circle');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/context'] });
      setCircleMenuOpen(false);
    },
  });

  if (contextLoading || !context) {
    return (
      <div className="flex items-center gap-2 animate-pulse" data-testid="context-indicator-loading">
        <div className="h-6 w-20 bg-muted rounded" />
        <div className="h-6 w-24 bg-muted rounded" />
      </div>
    );
  }

  const memberTenant = context.memberships.find(m => m.tenant_id === context.current_tenant_id);
  const tenantName = context.is_impersonating && context.impersonated_tenant
    ? context.impersonated_tenant.name
    : memberTenant?.tenant_name;
  
  const portalName = context.is_impersonating && context.impersonated_tenant?.portal_slug
    ? context.impersonated_tenant.portal_slug
    : context.current_portal?.name;

  const circles = circlesData?.circles || [];

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="context-indicator">
      {portalName && (
        <Badge 
          variant="outline" 
          className="text-xs gap-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800"
          data-testid="badge-portal"
        >
          <Globe className="h-3 w-3" />
          <span className="max-w-[100px] truncate">Portal: {portalName}</span>
        </Badge>
      )}
      
      {tenantName && (
        <Badge 
          variant="outline" 
          className="text-xs gap-1"
          data-testid="badge-tenant"
        >
          <Building2 className="h-3 w-3" />
          <span className="max-w-[120px] truncate">Tenant: {tenantName}</span>
          {context.is_impersonating && (
            <span className="text-amber-600 dark:text-amber-400 ml-1">(imp)</span>
          )}
        </Badge>
      )}

      <DropdownMenu open={circleMenuOpen} onOpenChange={setCircleMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant={context.acting_as_circle ? 'secondary' : 'ghost'}
            size="sm"
            className={`h-7 px-2 gap-1 ${
              context.acting_as_circle 
                ? 'bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50' 
                : ''
            }`}
            data-testid="button-circle-menu"
          >
            <Users className="h-3.5 w-3.5" />
            {context.acting_as_circle && context.current_circle ? (
              <>
                <span className="max-w-[80px] truncate text-xs">
                  {context.current_circle.name}
                </span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                  Acting as Circle
                </Badge>
              </>
            ) : (
              <span className="text-xs">Circle: None</span>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {circles.length === 0 ? (
            <DropdownMenuItem disabled className="text-muted-foreground">
              No circles available
            </DropdownMenuItem>
          ) : (
            <>
              {circles.map(circle => (
                <DropdownMenuItem
                  key={circle.id}
                  onClick={() => switchCircleMutation.mutate(circle.id)}
                  className={context.current_circle_id === circle.id ? 'bg-accent' : ''}
                  data-testid={`circle-option-${circle.slug}`}
                >
                  <Users className="h-4 w-4 mr-2" />
                  <div className="flex flex-col">
                    <span>{circle.name}</span>
                    {circle.role_name && (
                      <span className="text-xs text-muted-foreground">{circle.role_name}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}
          {context.acting_as_circle && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => clearCircleMutation.mutate()}
                className="text-destructive focus:text-destructive"
                data-testid="button-clear-circle"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Circle
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
