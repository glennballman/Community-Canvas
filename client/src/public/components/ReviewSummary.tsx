import { Calendar, Package, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PublicCartItem } from "../state/publicReservationMachine";

interface ReviewSummaryProps {
  items: PublicCartItem[];
  taxRate?: number;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getDateRange(items: PublicCartItem[]): { start: string | null; end: string | null } {
  if (items.length === 0) {
    return { start: null, end: null };
  }
  
  let earliestStart = new Date(items[0].starts_at);
  let latestEnd = new Date(items[0].ends_at);
  
  for (const item of items) {
    const start = new Date(item.starts_at);
    const end = new Date(item.ends_at);
    
    if (start < earliestStart) {
      earliestStart = start;
    }
    if (end > latestEnd) {
      latestEnd = end;
    }
  }
  
  return {
    start: earliestStart.toISOString(),
    end: latestEnd.toISOString(),
  };
}

function calculateSubtotal(items: PublicCartItem[]): number {
  return items.reduce((total, item) => {
    if (item.subtotal !== undefined && item.subtotal !== null) {
      return total + item.subtotal;
    }
    if (item.unit_price !== undefined && item.unit_price !== null) {
      const nights = calculateNights(item.starts_at, item.ends_at);
      return total + (item.unit_price * item.quantity * Math.max(nights, 1));
    }
    return total;
  }, 0);
}

export function ReviewSummary({ items, taxRate = 0.12 }: ReviewSummaryProps) {
  const dateRange = getDateRange(items);
  const subtotal = calculateSubtotal(items);
  const taxes = subtotal * taxRate;
  const total = subtotal + taxes;
  const hasPrice = subtotal > 0;
  
  return (
    <Card data-testid="review-summary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {dateRange.start && dateRange.end && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dates</p>
              <p className="font-medium" data-testid="text-summary-dates">
                {formatDate(dateRange.start)} → {formatDate(dateRange.end)}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Items</p>
            <p className="font-medium" data-testid="text-summary-items">
              {items.length} {items.length === 1 ? "item" : "items"}
            </p>
          </div>
        </div>

        {hasPrice && (
          <>
            <Separator />
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium" data-testid="text-summary-subtotal">
                  {formatPrice(subtotal)}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taxes / Fees</span>
                <span className="font-medium" data-testid="text-summary-taxes">
                  {formatPrice(taxes)}
                </span>
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-bold" data-testid="text-summary-total">
                  {formatPrice(total)}
                </span>
              </div>
            </div>
          </>
        )}
        
        <p className="text-xs text-muted-foreground" data-testid="text-summary-disclaimer">
          These totals reflect currently available inventory.
        </p>
      </CardContent>
    </Card>
  );
}
