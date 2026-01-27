/**
 * VIEW MODE TOGGLE
 * 
 * Toggle between Platform Admin and Founder Solo modes.
 * Only visible for platform admins.
 * Persists selection to localStorage.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, ChevronDown } from 'lucide-react';
import { getViewMode, setViewMode, ViewMode } from './AppHomeRedirect';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function ViewModeToggle(): React.ReactElement | null {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentMode, setCurrentMode] = useState<ViewMode>(getViewMode);

  // Phase 2C-16: Only show for platform admins (AuthContext, camelCase)
  if (!user?.isPlatformAdmin) {
    return null;
  }

  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    setCurrentMode(mode);
    
    // Redirect based on mode
    if (mode === 'admin') {
      navigate('/app/platform');
    } else {
      navigate('/app/founder');
    }
  };

  const modes: { value: ViewMode; label: string; icon: typeof Shield; description: string }[] = [
    {
      value: 'admin',
      label: 'Platform Admin',
      icon: Shield,
      description: 'Manage all tenants & platform settings',
    },
    {
      value: 'founder',
      label: 'Founder Solo',
      icon: User,
      description: 'Personal dashboard with full nav access',
    },
  ];

  const currentModeInfo = modes.find(m => m.value === currentMode) || modes[0];
  const CurrentIcon = currentModeInfo.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          data-testid="button-view-mode-toggle"
        >
          <CurrentIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{currentModeInfo.label}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = currentMode === mode.value;
          return (
            <DropdownMenuItem
              key={mode.value}
              onClick={() => handleModeChange(mode.value)}
              className={isActive ? 'bg-accent' : ''}
              data-testid={`menu-item-mode-${mode.value}`}
            >
              <Icon className="h-4 w-4 mr-2" />
              <div className="flex flex-col">
                <span className="font-medium">{mode.label}</span>
                <span className="text-xs text-muted-foreground">{mode.description}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ViewModeToggle;
