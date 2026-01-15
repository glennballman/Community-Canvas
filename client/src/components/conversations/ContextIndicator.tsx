import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Users, Building2, Globe, Settings2 } from 'lucide-react';

interface UserContext {
  user: {
    id: string;
    email: string;
    full_name: string;
  };
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
  memberships: Array<{
    tenant_id: string;
    tenant_name: string;
    tenant_type: string;
  }>;
  is_impersonating: boolean;
  impersonated_tenant: {
    id: string;
    name: string;
    type: string;
    portal_slug?: string | null;
  } | null;
}

export function ContextIndicator() {
  const { data: context, isLoading } = useQuery<UserContext>({
    queryKey: ['/api/me/context'],
    staleTime: 30000,
  });

  if (isLoading || !context) {
    return null;
  }

  const memberTenant = context.memberships.find((m) => m.tenant_id === context.current_tenant_id);
  const tenantName = context.is_impersonating && context.impersonated_tenant
    ? context.impersonated_tenant.name
    : memberTenant?.tenant_name;
  
  const portalName = context.is_impersonating && context.impersonated_tenant?.portal_slug
    ? context.impersonated_tenant.portal_slug
    : context.current_portal?.name;

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="context-indicator">
      {portalName && (
        <Badge variant="outline" className="text-xs gap-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800">
          <Globe className="h-3 w-3" />
          <span className="max-w-[100px] truncate">{portalName}</span>
        </Badge>
      )}
      
      {tenantName && (
        <Badge variant="outline" className="text-xs gap-1">
          <Building2 className="h-3 w-3" />
          <span className="max-w-[120px] truncate">{tenantName}</span>
          {context.is_impersonating && (
            <span className="text-amber-600 dark:text-amber-400 ml-1">(imp)</span>
          )}
        </Badge>
      )}

      {context.acting_as_circle && context.current_circle && (
        <Badge 
          variant="secondary" 
          className="text-xs gap-1 bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300"
        >
          <Users className="h-3 w-3" />
          <span className="max-w-[120px] truncate">{context.current_circle.name}</span>
        </Badge>
      )}

      <Link href="/app/circles">
        <Button variant="ghost" size="sm" className="h-7 px-2" data-testid="button-switch-circle">
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
      </Link>
    </div>
  );
}
