import { Calendar, Users, Ruler, Zap, Package, Ship, Car, Home, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PublicCartItem } from "../state/publicReservationMachine";

interface ReviewItemCardProps {
  item: PublicCartItem;
  itemType?: "lodging" | "parking" | "marina" | "equipment" | "activity";
}

function formatDateRange(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  
  const startStr = start.toLocaleDateString(undefined, options);
  const endStr = end.toLocaleDateString(undefined, options);
  
  if (startStr === endStr) {
    return startStr;
  }
  
  return `${startStr} → ${endStr}`;
}

function calculateNights(startsAt: string, endsAt: string): number {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatPrice(amount: number | undefined): string {
  if (amount === undefined || amount === null) return "";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(amount);
}

function deriveItemType(title: string): "lodging" | "parking" | "marina" | "equipment" | "activity" {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes("slip") || lowerTitle.includes("marina") || lowerTitle.includes("dock")) {
    return "marina";
  }
  if (lowerTitle.includes("stall") || lowerTitle.includes("parking") || lowerTitle.includes("spot")) {
    return "parking";
  }
  if (lowerTitle.includes("kayak") || lowerTitle.includes("boat") || lowerTitle.includes("rental") || lowerTitle.includes("gear")) {
    return "equipment";
  }
  if (lowerTitle.includes("tour") || lowerTitle.includes("excursion") || lowerTitle.includes("trip") || lowerTitle.includes("activity")) {
    return "activity";
  }
  return "lodging";
}

function getTypeIcon(type: string) {
  switch (type) {
    case "marina":
      return Ship;
    case "parking":
      return Car;
    case "equipment":
      return Package;
    case "activity":
      return Ticket;
    default:
      return Home;
  }
}

function getTypeLabel(type: string): string {
  switch (type) {
    case "marina":
      return "Marina Slip";
    case "parking":
      return "Parking";
    case "equipment":
      return "Equipment Rental";
    case "activity":
      return "Activity";
    default:
      return "Lodging";
  }
}

export function ReviewItemCard({ item, itemType }: ReviewItemCardProps) {
  const type = itemType || deriveItemType(item.title);
  const TypeIcon = getTypeIcon(type);
  const nights = calculateNights(item.starts_at, item.ends_at);
  const hasPrice = item.unit_price !== undefined && item.unit_price !== null;
  
  return (
    <Card data-testid="review-item-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <TypeIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base" data-testid="text-item-title">
                {item.title}
              </CardTitle>
              <Badge variant="secondary" className="mt-1" data-testid="badge-item-type">
                {getTypeLabel(type)}
              </Badge>
            </div>
          </div>
          {hasPrice && (
            <div className="text-right">
              <p className="text-lg font-semibold" data-testid="text-item-subtotal">
                {formatPrice(item.subtotal || (item.unit_price! * item.quantity * nights))}
              </p>
              {item.unit_price && (
                <p className="text-sm text-muted-foreground" data-testid="text-item-unit-price">
                  {formatPrice(item.unit_price)} / night
                </p>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Separator className="mb-4" />
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Dates</p>
              <p className="font-medium" data-testid="text-item-dates">
                {formatDateRange(item.starts_at, item.ends_at)}
              </p>
            </div>
          </div>
          
          {nights > 0 && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium" data-testid="text-item-nights">
                  {nights} {nights === 1 ? "night" : "nights"}
                </p>
              </div>
            </div>
          )}

          {item.quantity > 1 && (
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Quantity</p>
                <p className="font-medium" data-testid="text-item-quantity">
                  {item.quantity}
                </p>
              </div>
            </div>
          )}

          {type === "lodging" && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Guests</p>
                <p className="font-medium" data-testid="text-item-guests">
                  Up to maximum capacity
                </p>
              </div>
            </div>
          )}

          {type === "marina" && (
            <>
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Max Length</p>
                  <p className="font-medium" data-testid="text-item-length">
                    As specified
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-muted-foreground">Power</p>
                  <p className="font-medium" data-testid="text-item-power">
                    If required
                  </p>
                </div>
              </div>
            </>
          )}

          {type === "parking" && (
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-muted-foreground">Vehicle</p>
                <p className="font-medium" data-testid="text-item-vehicle">
                  Standard size
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
