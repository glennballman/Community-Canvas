import { DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PublicCartItem } from "../state/publicReservationMachine";

interface ConfirmFinanceSummaryProps {
  items: PublicCartItem[];
  taxRate?: number;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

function calculateNights(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function calculateSubtotal(items: PublicCartItem[]): number {
  return items.reduce((total, item) => {
    if (item.subtotal !== undefined && item.subtotal !== null) {
      return total + item.subtotal;
    }
    if (item.unit_price !== undefined && item.unit_price !== null) {
      const nights = calculateNights(item.starts_at, item.ends_at);
      return total + (item.unit_price * item.quantity * nights);
    }
    return total;
  }, 0);
}

export function ConfirmFinanceSummary({ items, taxRate = 0.12 }: ConfirmFinanceSummaryProps) {
  const subtotal = calculateSubtotal(items);
  const taxes = subtotal * taxRate;
  const total = subtotal + taxes;
  const hasPrice = subtotal > 0;

  if (!hasPrice) {
    return (
      <Card data-testid="confirm-finance-summary">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Finance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pricing will be confirmed after submission.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="confirm-finance-summary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Finance Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {items.map((item, index) => {
            const nights = calculateNights(item.starts_at, item.ends_at);
            const itemTotal = item.subtotal || (item.unit_price ? item.unit_price * item.quantity * nights : 0);
            
            return (
              <div 
                key={item.id || index} 
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground truncate max-w-[60%]">
                  {item.title}
                </span>
                <span className="font-medium">
                  {itemTotal > 0 ? formatPrice(itemTotal) : "—"}
                </span>
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium" data-testid="text-finance-subtotal">
            {formatPrice(subtotal)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Taxes / Fees (est.)</span>
          <span className="font-medium" data-testid="text-finance-taxes">
            {formatPrice(taxes)}
          </span>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-lg font-bold" data-testid="text-finance-total">
            {formatPrice(total)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground pt-2">
          Final amount will be confirmed upon reservation approval.
        </p>
      </CardContent>
    </Card>
  );
}
