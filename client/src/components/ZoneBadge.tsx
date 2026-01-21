/**
 * ZoneBadge - Context-aware zone label display
 * 
 * SECURITY INVARIANT (Contractor Preview Safety):
 * This component ONLY displays zone data passed via props.
 * It NEVER fetches or derives zone data from external sources.
 * In /preview/contractor/* routes, zone data must come from the 
 * already-disclosed work request payload only.
 * 
 * VIEWER CONTEXT OVERRIDE:
 * Explicit viewerContext prop ALWAYS wins over route-based inference.
 * This ensures edge routes are never misclassified.
 */

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
  /** 
   * OVERRIDE: When provided, this ALWAYS wins over route-based inference.
   * Use this for deterministic control in edge cases.
   */
  viewerContext?: ViewerContext;
  /**
   * Portal type for public portal pages. When provided on /p/* or /trip/* routes,
   * this is used to derive visitor vs resident context instead of just URL pattern.
   */
  portalType?: string;
  className?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

/**
 * Infer viewer context from route and optional hints.
 * This is only used as a fallback when explicit viewerContext is not provided.
 */
export function determineViewerContext(
  pathname: string,
  options?: {
    isContractorDisclosure?: boolean;
    portalType?: string;
    userRole?: string;
  }
): ViewerContext {
  const { isContractorDisclosure, portalType, userRole } = options || {};

  if (isContractorDisclosure) {
    return 'contractor';
  }

  if (pathname.startsWith('/preview/contractor')) {
    return 'contractor';
  }

  if (pathname.startsWith('/p/') || pathname.startsWith('/trip/')) {
    if (portalType) {
      if (portalType === 'community' || portalType === 'strata' || portalType === 'hoa') {
        return 'resident';
      }
      return 'visitor';
    }
    return 'visitor';
  }

  if (pathname.startsWith('/app/')) {
    return 'resident';
  }

  return 'visitor';
}

/**
 * Get the appropriate badge label for a zone based on viewer context.
 * Fallback chain: badge_label_X (if non-null) → zone.name → zone.key
 */
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
  portalType,
  className = '',
  variant = 'secondary'
}: ZoneBadgeProps) {
  const location = useLocation();
  
  // INVARIANT: Explicit viewerContext prop ALWAYS wins over inference
  const viewerContext = explicitContext ?? determineViewerContext(location.pathname, { portalType });
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
