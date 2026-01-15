/**
 * Operations Board Placeholder
 * Route: /app/ops
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

export default function OpsBoardPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-ops-board">
      <div className="flex items-center gap-3">
        <Calendar className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Operations Board</h1>
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
              <li>15-minute precision scheduling grid</li>
              <li>Resource allocation view</li>
              <li>Drag-and-drop work order assignment</li>
              <li>Real-time status updates</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
