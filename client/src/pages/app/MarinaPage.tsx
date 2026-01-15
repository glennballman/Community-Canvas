/**
 * Marina Placeholder
 * Route: /app/marina
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Anchor } from 'lucide-react';

export default function MarinaPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-marina">
      <div className="flex items-center gap-3">
        <Anchor className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Marina</h1>
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
              <li>Slip/mooring inventory</li>
              <li>Vessel registry</li>
              <li>Seasonal reservations</li>
              <li>Fuel dock scheduling</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
