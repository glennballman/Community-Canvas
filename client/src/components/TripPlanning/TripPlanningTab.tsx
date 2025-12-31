import { useState } from 'react';
import { 
  Compass, 
  User, 
  Car, 
  CheckCircle, 
  MapPin, 
  Wrench,
  Target,
  ChevronRight
} from 'lucide-react';
import { ParticipantProfile, VehicleProfile } from '../../types/tripPlanning';
import { ParticipantProfileForm } from './ParticipantProfileForm';
import { VehicleProfileForm } from './VehicleProfileForm';
import { TripQualificationCheck } from './TripQualificationCheck';
import { ServiceRunsBoard } from './ServiceRunsBoard';
import { RouteExplorer } from './RouteExplorer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type PlanningView = 'overview' | 'participant' | 'vehicle' | 'qualify' | 'service-runs' | 'routes';

export function TripPlanningTab() {
  const [activeView, setActiveView] = useState<PlanningView>('overview');
  const [currentParticipant, setCurrentParticipant] = useState<ParticipantProfile | null>(null);
  const [currentVehicle, setCurrentVehicle] = useState<VehicleProfile | null>(null);

  const renderView = () => {
    switch (activeView) {
      case 'participant':
        return (
          <ParticipantProfileForm 
            participant={currentParticipant}
            onSave={(p) => {
              setCurrentParticipant(p);
              setActiveView('overview');
            }}
            onCancel={() => setActiveView('overview')}
          />
        );
      case 'vehicle':
        return (
          <VehicleProfileForm
            vehicle={currentVehicle}
            onSave={(v) => {
              setCurrentVehicle(v);
              setActiveView('overview');
            }}
            onCancel={() => setActiveView('overview')}
          />
        );
      case 'qualify':
        return (
          <TripQualificationCheck
            participant={currentParticipant}
            vehicle={currentVehicle}
            onBack={() => setActiveView('overview')}
          />
        );
      case 'service-runs':
        return (
          <ServiceRunsBoard
            onBack={() => setActiveView('overview')}
          />
        );
      case 'routes':
        return (
          <RouteExplorer
            vehicle={currentVehicle}
            onBack={() => setActiveView('overview')}
          />
        );
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Compass className="w-8 h-8 text-primary" />
            <div>
              <CardTitle className="text-2xl">Trip Planning Center</CardTitle>
              <CardDescription>
                Assess your skills, check your vehicle, and find out if you're ready for BC's adventures.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <User className="w-8 h-8 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Your Profile</CardTitle>
                  <CardDescription>Skills & certifications</CardDescription>
                </div>
              </div>
              {currentParticipant ? (
                <Badge variant="outline" className="text-green-600 border-green-600">Complete</Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">Not Set</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {currentParticipant ? (
              <div className="space-y-2 mb-4">
                <p className="font-medium">{currentParticipant.name}</p>
                <p className="text-sm text-muted-foreground">
                  Fitness: {currentParticipant.fitness_level}/10 | Swimming: {currentParticipant.swimming_ability}
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentParticipant.skills?.length || 0} skills registered
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                Create your profile to check trip qualifications
              </p>
            )}
            <Button 
              onClick={() => setActiveView('participant')}
              className="w-full"
              data-testid="button-edit-profile"
            >
              {currentParticipant ? 'Edit Profile' : 'Create Profile'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <Car className="w-8 h-8 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Your Vehicle</CardTitle>
                  <CardDescription>Assessment & suitability</CardDescription>
                </div>
              </div>
              {currentVehicle ? (
                <Badge variant="outline" className="text-green-600 border-green-600">Added</Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">Not Set</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {currentVehicle ? (
              <div className="space-y-2 mb-4">
                <p className="font-medium">
                  {currentVehicle.year} {currentVehicle.make} {currentVehicle.model}
                </p>
                <p className="text-sm text-muted-foreground capitalize">
                  {currentVehicle.vehicle_class?.replace('_', ' ')} | {currentVehicle.drive_type?.toUpperCase()}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {currentVehicle.rough_gravel_suitable && (
                    <Badge variant="secondary" className="text-xs">Gravel OK</Badge>
                  )}
                  {currentVehicle.four_x_four_required_suitable && (
                    <Badge variant="secondary" className="text-xs">4x4 Ready</Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">
                Add your vehicle to check route suitability
              </p>
            )}
            <Button 
              onClick={() => setActiveView('vehicle')}
              className="w-full"
              data-testid="button-edit-vehicle"
            >
              {currentVehicle ? 'Edit Vehicle' : 'Add Vehicle'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className="cursor-pointer hover-elevate transition-shadow"
          onClick={() => setActiveView('qualify')}
          data-testid="card-check-qualification"
        >
          <CardContent className="pt-6">
            <CheckCircle className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Check Trip Qualification</h3>
            <p className="text-sm text-muted-foreground">
              See if you're ready for a specific trip and what gaps to fill
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate transition-shadow"
          onClick={() => setActiveView('routes')}
          data-testid="card-explore-routes"
        >
          <CardContent className="pt-6">
            <MapPin className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Explore Routes</h3>
            <p className="text-sm text-muted-foreground">
              View route segments, conditions, and alternatives
            </p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover-elevate transition-shadow"
          onClick={() => setActiveView('service-runs')}
          data-testid="card-service-runs"
        >
          <CardContent className="pt-6">
            <Wrench className="w-8 h-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Service Runs</h3>
            <p className="text-sm text-muted-foreground">
              See upcoming service trips to remote areas
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">How It Works</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">1.</span>
              <span className="text-muted-foreground">Create your profile with skills and certifications</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">2.</span>
              <span className="text-muted-foreground">Add your vehicle and complete the assessment</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">3.</span>
              <span className="text-muted-foreground">Check qualification for trips you want to do</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary font-bold">4.</span>
              <span className="text-muted-foreground">Fill gaps with training, rentals, or alternatives</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-4">
      {renderView()}
    </div>
  );
}

export default TripPlanningTab;
