/**
 * OperatorInsuranceIndexPage - Insurance operations index
 * Route: /app/operator/insurance
 */

import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Shield, Info } from 'lucide-react';
import { OperatorIdOpenCard } from '@/components/operator/OperatorIdOpenCard';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';

export default function OperatorInsuranceIndexPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator-insurance');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const handleOpenClaim = (claimId: string) => {
    navigate(`/app/operator/insurance/claims/${claimId}`);
  };
  
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/app/operator">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-6 w-6" />
            Insurance Operations
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage claim dossiers, exports, and authority sharing
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <OperatorIdOpenCard
          label="Open Claim by ID"
          description="Navigate to a claim to assemble dossiers"
          placeholder="Enter claim UUID"
          onOpen={handleOpenClaim}
        />
        
        <Card data-testid="card-workflow-info">
          <CardHeader>
            <CardTitle className="text-base">Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Open a claim by its ID</p>
            <p>2. Assemble a dossier from claim inputs</p>
            <p>3. Export the dossier as a zip package</p>
            <p>4. Share with external adjusters via authority grant</p>
          </CardContent>
        </Card>
      </div>
      
      <Separator />
      
      <Card data-testid="card-info">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            About Insurance Dossiers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Insurance dossiers compile all evidence, documentation, and audit trails 
            related to a claim into a verifiable package. Dossiers can be exported 
            for offline review or shared with adjusters through secure authority grants.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
