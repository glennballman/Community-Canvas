import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Receipt, CreditCard, MinusCircle, DollarSign, Link2, Bed, Coffee, Activity, Car, Anchor } from 'lucide-react';
import type { ProposalParticipant } from '@/lib/api/proposals';

interface FolioSummaryCardProps {
  participant: ProposalParticipant;
  showDetails?: boolean;
  compact?: boolean;
}

function formatCurrency(cents: number | undefined | null): string {
  const amount = (cents || 0) / 100;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

function getCategoryIcon(category: string) {
  switch (category?.toLowerCase()) {
    case 'lodging':
      return <Bed className="w-3 h-3" />;
    case 'food_beverage':
      return <Coffee className="w-3 h-3" />;
    case 'activity_rental':
      return <Activity className="w-3 h-3" />;
    case 'parking':
      return <Car className="w-3 h-3" />;
    case 'moorage':
      return <Anchor className="w-3 h-3" />;
    default:
      return <Receipt className="w-3 h-3" />;
  }
}

export function FolioSummaryCard({ participant, showDetails = false, compact = false }: FolioSummaryCardProps) {
  const folio = participant.folio;
  const summary = folio?.summary;
  
  if (!folio) {
    return (
      <Card className={compact ? 'border-0 shadow-none' : ''} data-testid="folio-summary-empty">
        <CardContent className={compact ? 'p-0' : 'pt-4'}>
          <div className="text-sm text-muted-foreground text-center py-4">
            No folio associated
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const totalCharges = summary?.totalCharges || 0;
  const totalCredits = summary?.totalReversals || 0;
  const netBalance = summary?.netBalance || 0;
  const totalPayments = totalCharges - totalCredits - netBalance;
  
  return (
    <Card className={compact ? 'border-0 shadow-none bg-transparent' : ''} data-testid="folio-summary-card">
      {!compact && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Folio Summary
            </span>
            <Badge variant="outline" className="text-xs font-normal">
              {folio.folio_number}
            </Badge>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? 'p-0' : ''}>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Charges</span>
            <span className="font-medium" data-testid="total-charges">
              {formatCurrency(totalCharges)}
            </span>
          </div>
          
          {totalCredits > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <MinusCircle className="w-3 h-3" />
                Credits/Reversals
              </span>
              <span className="text-green-600 dark:text-green-400" data-testid="total-credits">
                -{formatCurrency(totalCredits)}
              </span>
            </div>
          )}
          
          {totalPayments > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                Payments Made
              </span>
              <span className="text-green-600 dark:text-green-400" data-testid="total-payments">
                -{formatCurrency(totalPayments)}
              </span>
            </div>
          )}
          
          <Separator className="my-2" />
          
          <div className="flex items-center justify-between">
            <span className="font-medium flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              Outstanding Balance
            </span>
            <span 
              className={`font-bold ${netBalance > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}
              data-testid="outstanding-balance"
            >
              {formatCurrency(netBalance)}
            </span>
          </div>
        </div>
        
        {netBalance === 0 && totalCharges > 0 && (
          <div className="mt-4 text-center">
            <Badge variant="default" className="bg-green-600">
              Paid in Full
            </Badge>
          </div>
        )}
        
        {netBalance === 0 && totalCharges === 0 && (
          <div className="mt-2 text-sm text-muted-foreground text-center">
            No outstanding balance
          </div>
        )}
      </CardContent>
    </Card>
  );
}
