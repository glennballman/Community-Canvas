import { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Target,
  Car,
  Calendar,
  ChevronRight,
  Loader2,
  BookOpen,
  Lightbulb
} from 'lucide-react';
import { ParticipantProfile, VehicleProfile, TripAssessment, RouteAssessment, skillLevelColors, SkillLevel } from '../../types/tripPlanning';
import { RoadTrip } from '../../types/roadtrips';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TripQualificationCheckProps {
  participant: ParticipantProfile | null;
  vehicle: VehicleProfile | null;
  onBack: () => void;
}

export function TripQualificationCheck({ participant, vehicle, onBack }: TripQualificationCheckProps) {
  const [trips, setTrips] = useState<RoadTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<RoadTrip | null>(null);
  const [assessment, setAssessment] = useState<TripAssessment | null>(null);
  const [routeAssessment, setRouteAssessment] = useState<RouteAssessment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTrips();
  }, []);

  async function fetchTrips() {
    try {
      const response = await fetch('/api/v1/trips');
      const data = await response.json();
      setTrips(data.trips || []);
    } catch (error) {
      console.error('Error fetching trips:', error);
    }
  }

  async function assessTrip(trip: RoadTrip) {
    setSelectedTrip(trip);
    setLoading(true);
    setAssessment(null);
    setRouteAssessment(null);

    try {
      if (participant?.id) {
        const skillResponse = await fetch('/api/v1/planning/assess/participant-trip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participant_id: participant.id,
            trip_id: trip.id
          })
        });
        if (skillResponse.ok) {
          const skillData = await skillResponse.json();
          setAssessment(skillData);
        }
      }

      if (vehicle?.id) {
        const routeResponse = await fetch('/api/v1/planning/routes/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            route_segment_ids: ['bamfield-road'],
            vehicle_id: vehicle.id,
            date: new Date().toISOString()
          })
        });
        if (routeResponse.ok) {
          const routeData = await routeResponse.json();
          setRouteAssessment(routeData);
        }
      }
    } catch (error) {
      console.error('Error assessing trip:', error);
    } finally {
      setLoading(false);
    }
  }

  const isQualified = assessment?.qualified !== false && 
    (!routeAssessment || routeAssessment.blockers.length === 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-primary" />
                Trip Qualification Check
              </CardTitle>
              <CardDescription>Select a trip to see if you're ready</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {(!participant || !vehicle) && (
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                For complete assessment, please set up:
                {!participant && ' your profile'}
                {!participant && !vehicle && ' and'}
                {!vehicle && ' your vehicle'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Select a Trip</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {trips.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No trips available. Add trips first.
                </p>
              ) : (
                trips.map(trip => (
                  <button
                    key={trip.id}
                    onClick={() => assessTrip(trip)}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      selectedTrip?.id === trip.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                    data-testid={`button-trip-${trip.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{trip.title}</p>
                        <p className="text-sm opacity-80">{trip.region} | {trip.difficulty}</p>
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {!selectedTrip ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Select a trip to check your qualification</p>
              </div>
            ) : loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 mx-auto mb-2 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing trip requirements...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Card className={isQualified ? 'bg-green-500/20' : 'bg-red-500/20'}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      {isQualified ? (
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      ) : (
                        <XCircle className="w-8 h-8 text-red-500" />
                      )}
                      <div>
                        <p className={`font-bold text-lg ${isQualified ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isQualified ? "You're Ready!" : 'Not Qualified Yet'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {isQualified 
                            ? 'You meet the requirements for this trip'
                            : 'Some requirements need to be met first'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {assessment && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Skills Assessment
                    </h4>
                    
                    {assessment.gaps.length === 0 ? (
                      <p className="text-sm text-green-600 dark:text-green-400">All skill requirements met!</p>
                    ) : (
                      <div className="space-y-2">
                        {assessment.gaps.map((gap, i) => (
                          <Card key={i} className="bg-muted/50">
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="capitalize font-medium">
                                  {gap.skill_type.replace(/_/g, ' ')}
                                </span>
                                <Badge variant={gap.enforcement === 'required' ? 'destructive' : 'secondary'}>
                                  {gap.enforcement}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Badge className={skillLevelColors[gap.current_level as SkillLevel]}>
                                  You: {gap.current_level}
                                </Badge>
                                <ChevronRight className="w-4 h-4" />
                                <Badge className={skillLevelColors[gap.required_level as SkillLevel]}>
                                  Need: {gap.required_level}
                                </Badge>
                              </div>
                              
                              {gap.resolution_options && gap.resolution_options.length > 0 && (
                                <Card className="mt-2 bg-primary/5 border-primary/20">
                                  <CardContent className="pt-2 pb-2">
                                    <p className="text-xs font-medium text-primary mb-1 flex items-center gap-1">
                                      <BookOpen className="w-3 h-3" />
                                      How to qualify:
                                    </p>
                                    {gap.resolution_options.map((opt, j) => (
                                      <p key={j} className="text-sm text-muted-foreground">
                                        {opt.type === 'course' && `${opt.provider} - ${opt.duration} ($${opt.cost})`}
                                        {opt.type === 'experience' && opt.description}
                                      </p>
                                    ))}
                                  </CardContent>
                                </Card>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {assessment.warnings.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1">Warnings:</p>
                        {assessment.warnings.map((w, i) => (
                          <p key={i} className="text-sm text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-yellow-500" />
                            {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {routeAssessment && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      Vehicle Assessment
                    </h4>
                    
                    {routeAssessment.blockers.length === 0 && routeAssessment.warnings.length === 0 ? (
                      <p className="text-sm text-green-600 dark:text-green-400">Your vehicle is suitable for this route!</p>
                    ) : (
                      <div className="space-y-2">
                        {routeAssessment.blockers.map((b, i) => (
                          <div key={i} className="bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg p-2 text-sm flex items-center gap-2">
                            <XCircle className="w-4 h-4" />
                            {b}
                          </div>
                        ))}
                        {routeAssessment.warnings.map((w, i) => (
                          <div key={i} className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-lg p-2 text-sm flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            {w}
                          </div>
                        ))}
                      </div>
                    )}

                    {routeAssessment.recommendations.length > 0 && (
                      <Card className="mt-3 bg-primary/5 border-primary/20">
                        <CardContent className="pt-3 pb-3">
                          <p className="text-sm font-medium text-primary mb-1">Recommendations:</p>
                          {routeAssessment.recommendations.map((r, i) => (
                            <p key={i} className="text-sm text-muted-foreground flex items-center gap-1">
                              <Lightbulb className="w-3 h-3" />
                              {r}
                            </p>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  {isQualified ? (
                    <Button className="flex-1" data-testid="button-plan-trip">
                      <Calendar className="w-4 h-4 mr-2" />
                      Plan This Trip
                    </Button>
                  ) : (
                    <Button className="flex-1" data-testid="button-view-steps">
                      View Resolution Steps
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default TripQualificationCheck;
