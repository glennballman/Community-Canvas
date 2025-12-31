import { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  Wrench,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Clock,
  Phone,
  Mail,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { ServiceRun } from '../../types/tripPlanning';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ServiceRunsBoardProps {
  onBack: () => void;
}

export function ServiceRunsBoard({ onBack }: ServiceRunsBoardProps) {
  const [runs, setRuns] = useState<ServiceRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  useEffect(() => {
    fetchRuns();
  }, [selectedRegion]);

  async function fetchRuns() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ upcoming_only: 'true' });
      if (selectedRegion !== 'all') {
        params.append('region', selectedRegion);
      }
      
      const response = await fetch(`/api/v1/planning/service-runs?${params}`);
      const data = await response.json();
      setRuns(data.service_runs || []);
    } catch (error) {
      console.error('Error fetching service runs:', error);
    } finally {
      setLoading(false);
    }
  }

  const regions = ['all', 'Bamfield', 'Gold River', 'Tofino', 'Port Hardy'];

  const statusStyles: Record<string, string> = {
    planning: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
    published: 'bg-green-500/20 text-green-600 dark:text-green-400',
    confirmed: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
    in_progress: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
    completed: 'bg-muted text-muted-foreground',
    cancelled: 'bg-red-500/20 text-red-600 dark:text-red-400'
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-primary" />
                  Service Runs Board
                </CardTitle>
                <CardDescription>Upcoming service trips to remote areas with available slots</CardDescription>
              </div>
            </div>
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-[180px]" data-testid="select-region">
                <SelectValue placeholder="Filter by region" />
              </SelectTrigger>
              <SelectContent>
                {regions.map(r => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r === 'all' ? 'All Regions' : r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-2 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading service runs...</p>
          </CardContent>
        </Card>
      ) : runs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">No upcoming service runs found</p>
            <p className="text-sm text-muted-foreground mt-1">Check back later or try a different region</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {runs.map(run => (
            <Card key={run.id} className="hover-elevate">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{run.company_name}</CardTitle>
                    <CardDescription>{run.service_type}</CardDescription>
                  </div>
                  <Badge className={statusStyles[run.status] || statusStyles.planning}>
                    {run.status.replace('_', ' ')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{run.destination_region}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(run.planned_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{run.planned_duration_days} day{run.planned_duration_days > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{run.slots_available} of {run.total_job_slots} slots available</span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Cost per slot</p>
                    <p className="font-semibold flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {run.logistics_cost_per_slot.toLocaleString()}
                    </p>
                  </div>
                  {run.minimum_job_value && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Min job value</p>
                      <p className="font-semibold">${run.minimum_job_value.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {run.booking_deadline && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Book by: {new Date(run.booking_deadline).toLocaleDateString()}
                  </p>
                )}

                <div className="flex gap-2">
                  {run.slots_available > 0 ? (
                    <Button className="flex-1" data-testid={`button-book-${run.id}`}>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Book Slot
                    </Button>
                  ) : (
                    <Button className="flex-1" variant="secondary" disabled>
                      Fully Booked
                    </Button>
                  )}
                  {(run.contact_email || run.contact_phone) && (
                    <Button variant="outline" size="icon" data-testid={`button-contact-${run.id}`}>
                      {run.contact_email ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ServiceRunsBoard;
