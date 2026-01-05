import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign } from 'lucide-react';

export default function AvailabilityPricingPage() {
  return (
    <div className="space-y-6" data-testid="availability-pricing-page">
      <div>
        <h1 className="text-2xl font-bold">Availability & Pricing</h1>
        <p className="text-muted-foreground">
          Manage your calendar and pricing rules
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Availability Calendar
            </CardTitle>
            <CardDescription>
              Set when your items are available for booking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button data-testid="button-manage-calendar">
              Manage Calendar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Pricing Rules
            </CardTitle>
            <CardDescription>
              Configure pricing for different seasons and durations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" data-testid="button-manage-pricing">
              Manage Pricing
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
