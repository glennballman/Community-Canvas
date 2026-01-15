/**
 * Admin Home Placeholder
 * Route: /app/admin
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function AdminHomePage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-admin-home">
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Admin</h1>
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
              <li>Tenant settings</li>
              <li>User management</li>
              <li>Integration configuration</li>
              <li>Billing overview</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
