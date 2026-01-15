/**
 * Operator Home Placeholder
 * Route: /app/operator
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2 } from 'lucide-react';

export default function OperatorHomePage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-operator-home">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Operator</h1>
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
              <li>Operator onboarding status</li>
              <li>Document verification</li>
              <li>Business profile management</li>
              <li>Permit applications</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
