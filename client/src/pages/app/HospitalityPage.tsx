/**
 * Hospitality Placeholder
 * Route: /app/hospitality
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home } from 'lucide-react';

export default function HospitalityPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-hospitality">
      <div className="flex items-center gap-3">
        <Home className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Hospitality</h1>
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
              <li>Room/unit inventory</li>
              <li>Booking calendar</li>
              <li>Guest management</li>
              <li>Housekeeping schedules</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
