/**
 * OperatorAuthorityIndexPage - Central authority sharing management
 * Route: /app/operator/authority
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, ArrowLeft, Share2, FileCheck, Scale, AlertTriangle } from 'lucide-react';
import { OperatorIdOpenCard } from '@/components/operator/OperatorIdOpenCard';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';

export default function OperatorAuthorityIndexPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="p-6 space-y-6" data-testid="page-operator-authority">
      <div className="flex items-center gap-3">
        <Link to="/app/operator">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <Shield className="h-6 w-6" />
        <div>
          <h1 className="text-xl font-bold">Authority Sharing</h1>
          <p className="text-sm text-muted-foreground">Manage external access grants</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline">P2 Authority Operations</Badge>
      </div>

      <Separator />

      <div className="grid gap-6 md:grid-cols-2">
        <OperatorIdOpenCard
          label="Open Grant by ID"
          placeholder="Enter grant ID (UUID)"
          description="Navigate to a specific authority grant"
          onOpen={(id) => navigate(`/app/operator/authority/grants/${id}`)}
        />

        <Card data-testid="card-authority-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Share2 className="h-4 w-4" />
              Share from Workspaces
            </CardTitle>
            <CardDescription>
              Authority sharing is available from each workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              To share evidence with external authorities, use the Share tab in:
            </div>
            <div className="space-y-2">
              <Link to="/app/operator/emergency">
                <Button variant="outline" size="sm" className="w-full justify-start" data-testid="link-emergency">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Emergency Runs
                </Button>
              </Link>
              <Link to="/app/operator/insurance">
                <Button variant="outline" size="sm" className="w-full justify-start" data-testid="link-insurance">
                  <FileCheck className="h-4 w-4 mr-2" />
                  Insurance Claims
                </Button>
              </Link>
              <Link to="/app/operator/disputes">
                <Button variant="outline" size="sm" className="w-full justify-start" data-testid="link-disputes">
                  <Scale className="h-4 w-4 mr-2" />
                  Disputes
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-authority-notes">
        <CardHeader>
          <CardTitle className="text-base">Authority Access Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Authority grants provide read-only access to evidence for external parties 
            such as insurance adjusters, legal authorities, and auditors.
          </p>
          <p>
            Each grant is scoped to specific records and may include an expiration date.
            All grant activity is logged in the operator audit trail.
          </p>
          <p>
            <strong>Note:</strong> Grant revocation requires the grant ID. 
            Keep track of granted access from the workspace where sharing occurred.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
