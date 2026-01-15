/**
 * Parking Placeholder
 * Route: /app/parking
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Car } from 'lucide-react';

export default function ParkingPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-parking">
      <div className="flex items-center gap-3">
        <Car className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Parking</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">UI Placeholder</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Wiring pending in U2+
          </p>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Next actions:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Parking spot inventory</li>
              <li>Reservation calendar</li>
              <li>Permit management</li>
              <li>Availability grid</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
