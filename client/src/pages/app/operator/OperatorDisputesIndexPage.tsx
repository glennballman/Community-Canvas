/**
 * OperatorDisputesIndexPage - Disputes index
 * Route: /app/operator/disputes
 */

import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Swords, Info } from 'lucide-react';
import { OperatorIdOpenCard } from '@/components/operator/OperatorIdOpenCard';
import { assertNoForbiddenPricingCopy } from '@/lib/pricing/forbiddenCopy';

export default function OperatorDisputesIndexPage() {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        assertNoForbiddenPricingCopy(document.body.innerText, 'operator-disputes');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);
  
  const handleOpenDispute = (disputeId: string) => {
    navigate(`/app/operator/disputes/${disputeId}`);
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
            <Swords className="h-6 w-6" />
            Disputes
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage dispute resolution and defense packs
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <OperatorIdOpenCard
          label="Open Dispute by ID"
          description="Navigate to a dispute to manage defense"
          placeholder="Enter dispute UUID"
          onOpen={handleOpenDispute}
        />
        
        <Card data-testid="card-workflow-info">
          <CardHeader>
            <CardTitle className="text-base">Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Open a dispute by its ID</p>
            <p>2. Assemble a defense pack from linked evidence</p>
            <p>3. Export the defense pack for review</p>
            <p>4. Share with legal counsel via authority grant</p>
          </CardContent>
        </Card>
      </div>
      
      <Separator />
      
      <Card data-testid="card-info">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            About Defense Packs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Defense packs compile all evidence and documentation needed to defend 
            against disputes, claims, or allegations. They include tamper-evident 
            hashes and can be securely shared with legal representatives.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
