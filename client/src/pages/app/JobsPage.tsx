/**
 * Jobs Placeholder
 * Route: /app/jobs
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase } from 'lucide-react';

export default function JobsPage() {
  return (
    <div className="p-6 space-y-6" data-testid="page-jobs">
      <div className="flex items-center gap-3">
        <Briefcase className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">Jobs</h1>
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
              <li>Jobs Wedge integration</li>
              <li>Status pipeline view</li>
              <li>Assignment management</li>
              <li>CAP capability matching</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
