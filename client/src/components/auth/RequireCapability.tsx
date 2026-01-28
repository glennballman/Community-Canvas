/**
 * RequireCapability - Page-level visibility guard component
 * 
 * PROMPT-5: Wraps page content with capability check.
 * This is VISIBILITY-ONLY - backend always enforces via PROMPT-3/4.
 * 
 * Usage:
 *   <RequireCapability capability="tenant.configure">
 *     <AdminPage />
 *   </RequireCapability>
 */

import { ReactNode } from 'react';
import { useCanUI } from '@/auth/uiAuthorization';
import { NotAuthorized } from './NotAuthorized';

interface RequireCapabilityProps {
  /** The capability code to check */
  capability: string;
  /** Content to render if user has capability */
  children: ReactNode;
  /** Optional fallback component (defaults to NotAuthorized) */
  fallback?: ReactNode;
}

export function RequireCapability({ 
  capability, 
  children,
  fallback 
}: RequireCapabilityProps) {
  const canUI = useCanUI();
  
  if (!canUI(capability)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <NotAuthorized capability={capability} />;
  }
  
  return <>{children}</>;
}
