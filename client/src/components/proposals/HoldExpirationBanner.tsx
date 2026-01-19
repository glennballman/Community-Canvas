import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface HoldExpirationBannerProps {
  holdCreatedAt?: string;
  holdTtlMinutes?: number;
  onRelease?: () => void;
  showReleaseButton?: boolean;
}

export function HoldExpirationBanner({
  holdCreatedAt,
  holdTtlMinutes = 30,
  onRelease,
  showReleaseButton = false,
}: HoldExpirationBannerProps) {
  const [remainingMinutes, setRemainingMinutes] = useState<number | null>(null);
  
  useEffect(() => {
    if (!holdCreatedAt) {
      setRemainingMinutes(holdTtlMinutes);
      return;
    }
    
    const createdAt = new Date(holdCreatedAt);
    const expiresAt = new Date(createdAt.getTime() + holdTtlMinutes * 60 * 1000);
    
    const updateRemaining = () => {
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      const mins = Math.max(0, Math.ceil(diff / (1000 * 60)));
      setRemainingMinutes(mins);
    };
    
    updateRemaining();
    const interval = setInterval(updateRemaining, 30000);
    
    return () => clearInterval(interval);
  }, [holdCreatedAt, holdTtlMinutes]);
  
  if (remainingMinutes === null) {
    return null;
  }
  
  const isUrgent = remainingMinutes <= 5;
  const bgClass = isUrgent 
    ? 'bg-orange-500/10 border-orange-500/30' 
    : 'bg-blue-500/10 border-blue-500/30';
  const iconColor = isUrgent ? 'text-orange-500' : 'text-blue-500';
  
  return (
    <Card className={`p-3 ${bgClass} flex items-center justify-between`} data-testid="hold-expiration-banner">
      <div className="flex items-center gap-2">
        {isUrgent ? (
          <AlertTriangle className={`w-4 h-4 ${iconColor}`} />
        ) : (
          <Clock className={`w-4 h-4 ${iconColor}`} />
        )}
        <span className="text-sm">
          {remainingMinutes === 0 ? (
            'Hold has expired'
          ) : (
            <>
              Hold expires in{' '}
              <Badge variant={isUrgent ? 'destructive' : 'secondary'}>
                {remainingMinutes} {remainingMinutes === 1 ? 'minute' : 'minutes'}
              </Badge>
            </>
          )}
        </span>
      </div>
      {showReleaseButton && onRelease && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onRelease}
          data-testid="release-hold-button"
        >
          Release Hold
        </Button>
      )}
    </Card>
  );
}
