import { Badge } from '@/components/ui/badge';
import { useLocation } from 'react-router-dom';

export type ViewerContext = 'resident' | 'contractor' | 'visitor';

interface Zone {
  id: string;
  key: string;
  name: string;
  badge_label_resident?: string | null;
  badge_label_contractor?: string | null;
  badge_label_visitor?: string | null;
}

interface ZoneBadgeProps {
  zone: Zone;
  viewerContext?: ViewerContext;
  className?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

export function determineViewerContext(
  pathname: string,
  isContractorDisclosure?: boolean,
  portalType?: string,
  userRole?: string
): ViewerContext {
  if (isContractorDisclosure) {
    return 'contractor';
  }

  if (pathname.startsWith('/preview/contractor')) {
    return 'contractor';
  }

  if (pathname.startsWith('/p/') || pathname.startsWith('/trip/')) {
    if (portalType === 'community' || portalType === 'strata') {
      return 'resident';
    }
    return 'visitor';
  }

  if (pathname.startsWith('/app/')) {
    if (userRole === 'owner' || userRole === 'admin' || userRole === 'manager') {
      return 'resident';
    }
    return 'resident';
  }

  return 'visitor';
}

export function getZoneBadgeLabel(zone: Zone, viewerContext: ViewerContext): string {
  let label: string | null | undefined = null;

  switch (viewerContext) {
    case 'resident':
      label = zone.badge_label_resident;
      break;
    case 'contractor':
      label = zone.badge_label_contractor;
      break;
    case 'visitor':
      label = zone.badge_label_visitor;
      break;
  }

  if (label) {
    return label;
  }

  if (zone.name) {
    return zone.name;
  }

  return zone.key;
}

export function ZoneBadge({ 
  zone, 
  viewerContext: explicitContext, 
  className = '',
  variant = 'secondary'
}: ZoneBadgeProps) {
  const location = useLocation();
  
  const viewerContext = explicitContext ?? determineViewerContext(location.pathname);
  const label = getZoneBadgeLabel(zone, viewerContext);

  return (
    <Badge 
      variant={variant} 
      className={className}
      data-testid={`badge-zone-${zone.key}`}
      data-viewer-context={viewerContext}
    >
      {label}
    </Badge>
  );
}

export default ZoneBadge;
