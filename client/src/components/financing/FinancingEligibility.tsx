import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, ChevronDown, ChevronUp, Check, Circle } from 'lucide-react';

interface EligibilityData {
  owner_type: string | null;
  has_signed_contract: boolean;
  has_verified_scope: boolean;
  has_structured_bom: boolean;
  has_payment_milestones: boolean;
  materials_total: number;
  eligible_products: string[];
  can_request_financing: boolean;
  reasons: string[];
}

interface FinancingSuggestion {
  show_financing: boolean;
  headline: string;
  details: string;
  advance_estimate: number;
  fee_estimate: number;
}

interface FinancingEligibilityProps {
  opportunityId: string;
}

export function FinancingEligibility({ opportunityId }: FinancingEligibilityProps) {
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [suggestion, setSuggestion] = useState<FinancingSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchEligibility();
  }, [opportunityId]);

  async function fetchEligibility() {
    setLoading(true);
    try {
      const data = await api.get<{ eligibility: EligibilityData; suggestion: FinancingSuggestion }>(
        `/opportunities/${opportunityId}/financing-eligibility`
      );
      setEligibility(data.eligibility);
      setSuggestion(data.suggestion);
    } catch (error) {
      console.error('Error fetching financing eligibility:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse bg-muted rounded h-20"></div>;
  }

  if (!eligibility || !suggestion?.show_financing) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-green-200 dark:border-green-800">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <DollarSign className="h-8 w-8 text-green-600 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-800 dark:text-green-200">
              Materials & Mobilization Financing May Be Available
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              For verified scope + structured BOM, financing partners may advance materials or invoices, 
              especially for government, First Nation, or institutional work.
            </p>
            
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-green-600 dark:text-green-400 underline mt-2 flex items-center gap-1"
              data-testid="button-toggle-financing-details"
            >
              {showDetails ? (
                <>Hide details <ChevronUp className="h-4 w-4" /></>
              ) : (
                <>View eligibility indicators <ChevronDown className="h-4 w-4" /></>
              )}
            </button>
            
            {showDetails && (
              <div className="mt-3 bg-background rounded p-3 text-sm">
                <div className="text-xs font-medium text-muted-foreground mb-2">Eligibility Indicators</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`flex items-center gap-1 ${eligibility.owner_type ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {eligibility.owner_type ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    Owner type: {eligibility.owner_type || 'Not set'}
                  </div>
                  <div className={`flex items-center gap-1 ${eligibility.has_signed_contract ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {eligibility.has_signed_contract ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    Signed contract
                  </div>
                  <div className={`flex items-center gap-1 ${eligibility.has_verified_scope ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {eligibility.has_verified_scope ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    Verified scope
                  </div>
                  <div className={`flex items-center gap-1 ${eligibility.has_structured_bom ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {eligibility.has_structured_bom ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    Structured BOM
                  </div>
                  <div className={`flex items-center gap-1 ${eligibility.has_payment_milestones ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {eligibility.has_payment_milestones ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    Payment milestones
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Circle className="h-4 w-4" />
                    Contractor reliability (private)
                  </div>
                </div>
                
                {eligibility.materials_total > 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <span className="text-muted-foreground">Materials total: </span>
                    <span className="font-medium">${eligibility.materials_total.toLocaleString()}</span>
                  </div>
                )}
                
                <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                  {eligibility.eligible_products.length} financing product(s) may be available
                </div>
              </div>
            )}
            
            <Button 
              className="mt-3 bg-green-600 hover:bg-green-700" 
              data-testid="button-request-financing"
            >
              Request Materials Financing
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
