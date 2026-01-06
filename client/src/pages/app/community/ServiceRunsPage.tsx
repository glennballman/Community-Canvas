import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Truck, Clock, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ServiceRunsPage() {
  const runs = [
    { id: '1', name: 'Monthly Septic Service', status: 'scheduled', date: 'Jan 15, 2026', participants: 4 },
    { id: '2', name: 'Propane Delivery', status: 'in-progress', date: 'Jan 8, 2026', participants: 6 },
    { id: '3', name: 'Garbage Collection', status: 'completed', date: 'Jan 1, 2026', participants: 12 },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case 'in-progress':
        return <Badge><Truck className="h-3 w-3 mr-1" />In Progress</Badge>;
      case 'completed':
        return <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6" data-testid="service-runs-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Service Runs</h1>
          <p className="text-muted-foreground">
            Shared service runs for your community
          </p>
        </div>
        <Link to="/app/service-runs/new">
          <Button data-testid="button-new-service-run">
            <Plus className="h-4 w-4 mr-2" />
            New Service Run
          </Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {runs.map((run) => (
          <Card key={run.id} className="hover-elevate" data-testid={`card-service-run-${run.id}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{run.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{run.date}</p>
              </div>
              {getStatusBadge(run.status)}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {run.participants} participants
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
