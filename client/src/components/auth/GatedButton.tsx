/**
 * GatedButton - Capability-gated button component
 * 
 * PROMPT-5: Wraps a button with capability visibility check.
 * This is VISIBILITY-ONLY - backend always enforces via PROMPT-3/4.
 * 
 * When user lacks capability:
 *   - Button is hidden (default) OR
 *   - Button is disabled with tooltip
 * 
 * Usage:
 *   <GatedButton capability="users.delete" onClick={handleDelete}>
 *     Delete User
 *   </GatedButton>
 */

import { ReactNode, ComponentProps } from 'react';
import { useCanUI } from '@/auth/uiAuthorization';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface GatedButtonProps extends Omit<ComponentProps<typeof Button>, 'disabled'> {
  /** The capability code to check */
  capability: string;
  /** Button content */
  children: ReactNode;
  /** If true, show disabled button instead of hiding */
  showDisabled?: boolean;
  /** Tooltip text when disabled (only used with showDisabled) */
  disabledTooltip?: string;
}

export function GatedButton({ 
  capability, 
  children,
  showDisabled = false,
  disabledTooltip = "You don't have permission for this action",
  ...buttonProps 
}: GatedButtonProps) {
  const canUI = useCanUI();
  const hasCapability = canUI(capability);
  
  if (!hasCapability) {
    if (showDisabled) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button {...buttonProps} disabled>
                {children}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{disabledTooltip}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return null;
  }
  
  return (
    <Button {...buttonProps}>
      {children}
    </Button>
  );
}
