import { RefreshCw, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { publicCopy } from "../publicCopy";
import { 
  PublicCartItem, 
  PublicCartStatus, 
  isLocked,
} from "../state/publicReservationMachine";

interface CartPanelProps {
  items: PublicCartItem[];
  status: PublicCartStatus;
  isLoading: boolean;
  onRefresh: () => void;
  onRemoveItem?: (itemId: string) => void;
  onAddAnother?: () => void;
}

function formatDateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  
  const startStr = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const endStr = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  
  if (startStr === endStr) {
    return startStr;
  }
  
  return `${startStr} - ${endStr}`;
}

interface CartItemRowProps {
  item: PublicCartItem;
  locked: boolean;
  onRemove?: () => void;
}

function CartItemRow({ item, locked, onRemove }: CartItemRowProps) {
  return (
    <div 
      className="flex items-start justify-between gap-2 py-3"
      data-testid="cart-item"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate" data-testid="cart-item-title">
          {item.title}
        </p>
        <p className="text-sm text-muted-foreground" data-testid="cart-item-dates">
          {formatDateRange(item.starts_at, item.ends_at)}
        </p>
        {item.quantity > 1 && (
          <p className="text-sm text-muted-foreground">
            Qty: {item.quantity}
          </p>
        )}
      </div>
      {!locked && onRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={publicCopy.cart.removeItem}
          data-testid="button-remove-item"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}

export function CartPanel({
  items,
  status,
  isLoading,
  onRefresh,
  onRemoveItem,
  onAddAnother,
}: CartPanelProps) {
  const locked = isLocked(status);
  const isEmpty = items.length === 0;

  return (
    <Card data-testid="cart-panel">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base" data-testid="text-cart-title">
          {publicCopy.cart.yourReservation}
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label={publicCopy.buttons.refresh}
          data-testid="button-refresh-cart"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div 
            className="py-8 text-center text-sm text-muted-foreground"
            data-testid="cart-empty-state"
          >
            <p>{publicCopy.empty.cartEmpty}</p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                locked={locked}
                onRemove={onRemoveItem ? () => onRemoveItem(item.id) : undefined}
              />
            ))}
          </div>
        )}

        {!locked && onAddAnother && (
          <>
            <Separator className="my-4" />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onAddAnother}
              data-testid="button-add-another"
            >
              <Plus className="h-4 w-4 mr-2" />
              {publicCopy.buttons.addAnother}
            </Button>
          </>
        )}

        {!isEmpty && (
          <>
            <Separator className="my-4" />
            <div className="text-sm text-muted-foreground">
              {publicCopy.cart.itemCount(items.length)}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
