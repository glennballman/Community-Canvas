import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Lock, PartyPopper, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface QuickTripQualificationProps {
  participantId: string;
}

interface TripStatus {
  id: string;
  title: string;
  qualified: boolean;
  gapCount: number;
  difficulty: string;
  error?: boolean;
}

export function QuickTripQualification({ participantId }: QuickTripQualificationProps) {
  const [tripStatuses, setTripStatuses] = useState<TripStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    checkAllTrips();
  }, [participantId]);

  async function checkAllTrips() {
    setLoading(true);
    setError(false);
    try {
      const tripsRes = await fetch('/api/v1/trips');
      if (!tripsRes.ok) {
        throw new Error('Failed to fetch trips');
      }
      const tripsData = await tripsRes.json();
      
      const statuses: TripStatus[] = [];
      
      for (const trip of tripsData.trips || []) {
        try {
          const assessRes = await fetch('/api/v1/planning/assess/participant-trip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participant_id: participantId, trip_id: trip.id })
          });
          
          if (!assessRes.ok) {
            statuses.push({
              id: trip.id,
              title: trip.title,
              qualified: false,
              gapCount: 0,
              difficulty: trip.difficulty || 'unknown',
              error: true
            });
            continue;
          }
          
          const assessment = await assessRes.json();
          
          statuses.push({
            id: trip.id,
            title: trip.title,
            qualified: assessment.qualified !== false,
            gapCount: assessment.required_actions?.length || 0,
            difficulty: trip.difficulty || 'unknown'
          });
        } catch {
          statuses.push({
            id: trip.id,
            title: trip.title,
            qualified: false,
            gapCount: 0,
            difficulty: trip.difficulty || 'unknown',
            error: true
          });
        }
      }
      
      statuses.sort((a, b) => {
        if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
        return a.gapCount - b.gapCount;
      });
      
      setTripStatuses(statuses);
    } catch (error) {
      console.error('Error checking trips:', error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin mr-2 text-muted-foreground" />
        <span className="text-muted-foreground">Checking your qualifications...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <AlertCircle className="w-5 h-5 mr-2 text-yellow-500" />
        <span>Unable to check qualifications. Please try again later.</span>
      </div>
    );
  }

  const qualifiedTrips = tripStatuses.filter(t => t.qualified && !t.error);
  const notQualifiedTrips = tripStatuses.filter(t => !t.qualified);

  return (
    <div className="space-y-4" data-testid="quick-trip-qualification">
      {qualifiedTrips.length > 0 && (
        <div>
          <p className="text-green-400 text-sm font-medium mb-2 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            Ready to Go ({qualifiedTrips.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {qualifiedTrips.map(trip => (
              <Badge 
                key={trip.id}
                variant="secondary"
                className="bg-green-500/20 text-green-400 border-green-500/30"
                data-testid={`badge-qualified-${trip.id}`}
              >
                {trip.title}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {notQualifiedTrips.length > 0 && (
        <div>
          <p className="text-orange-400 text-sm font-medium mb-2 flex items-center gap-1">
            <Lock className="w-4 h-4" />
            Unlock with More Skills ({notQualifiedTrips.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {notQualifiedTrips.map(trip => (
              <Badge 
                key={trip.id}
                variant="secondary"
                className="bg-orange-500/20 text-orange-400 border-orange-500/30"
                data-testid={`badge-locked-${trip.id}`}
              >
                {trip.title}
                <span className="ml-1 text-xs opacity-70">
                  ({trip.gapCount} skill{trip.gapCount !== 1 ? 's' : ''})
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {qualifiedTrips.length === tripStatuses.length && tripStatuses.length > 0 && (
        <p className="text-muted-foreground text-sm text-center py-2 flex items-center justify-center gap-1">
          <PartyPopper className="w-4 h-4 text-green-400" />
          Amazing! You're qualified for all trips!
        </p>
      )}
    </div>
  );
}

export default QuickTripQualification;
