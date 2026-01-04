import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Button } from '@/components/ui/button';
import { Shield, Clock, X } from 'lucide-react';

export function ImpersonationBanner() {
  const { session, isActive, loading, stop } = useImpersonation();

  if (!isActive || !session) {
    return null;
  }

  const expiresAt = new Date(session.expires_at);
  const now = new Date();
  const remainingMs = expiresAt.getTime() - now.getTime();
  const remainingMins = Math.max(0, Math.ceil(remainingMs / 60000));

  const handleStop = async () => {
    await stop();
    window.location.reload();
  };

  return (
    <div
      data-testid="impersonation-banner"
      className="sticky top-0 z-[9999] w-full bg-amber-500 dark:bg-amber-600 text-amber-950 dark:text-amber-50 px-4 py-2"
    >
      <div className="flex items-center justify-between gap-4 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3 flex-wrap">
          <Shield className="w-5 h-5 flex-shrink-0" />
          <span className="font-semibold" data-testid="text-impersonation-tenant">
            Impersonating: {session.tenant_name}
          </span>
          {session.individual_name && (
            <span className="text-amber-800 dark:text-amber-200" data-testid="text-impersonation-individual">
              as {session.individual_name}
            </span>
          )}
          <span className="flex items-center gap-1 text-sm text-amber-800 dark:text-amber-200">
            <Clock className="w-4 h-4" />
            <span data-testid="text-impersonation-expires">
              {remainingMins > 60 
                ? `${Math.floor(remainingMins / 60)}h ${remainingMins % 60}m remaining`
                : `${remainingMins}m remaining`
              }
            </span>
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleStop}
          disabled={loading}
          className="bg-amber-100 dark:bg-amber-700 border-amber-600 dark:border-amber-400 text-amber-900 dark:text-amber-50"
          data-testid="button-exit-impersonation"
        >
          <X className="w-4 h-4 mr-1" />
          Exit Impersonation
        </Button>
      </div>
    </div>
  );
}
