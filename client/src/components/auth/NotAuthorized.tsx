/**
 * NotAuthorized - Standard unauthorized access component
 * 
 * PROMPT-5: Display-only component for pages where user lacks capability.
 * This is purely a UI hint - backend always enforces via PROMPT-3/4.
 */

import { ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

interface NotAuthorizedProps {
  /** The capability that was required */
  capability?: string;
  /** Custom message to display */
  message?: string;
  /** Whether to show back button */
  showBackButton?: boolean;
}

export function NotAuthorized({ 
  capability, 
  message = "You don't have permission to view this page.",
  showBackButton = true 
}: NotAuthorizedProps) {
  const [, navigate] = useLocation();

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4" data-testid="not-authorized">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <ShieldAlert className="h-12 w-12 text-muted-foreground" />
          </div>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          {capability && (
            <p className="text-xs text-muted-foreground mb-4">
              Required: <code className="bg-muted px-1 py-0.5 rounded">{capability}</code>
            </p>
          )}
          {showBackButton && (
            <Button 
              variant="outline" 
              onClick={() => navigate('/app')}
              data-testid="button-go-back"
            >
              Go Back
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
