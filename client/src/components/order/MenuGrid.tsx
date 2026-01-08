import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Trash2 } from "lucide-react";
import type { MenuItem, CartItem } from "@/hooks/useMenuCart";

type MenuGridProps = {
  items: MenuItem[];
  cart: CartItem[];
  onItemClick: (item: MenuItem) => void;
  onQuantityChange?: (menuItemId: number, delta: number) => void;
  onRemove?: (menuItemId: number) => void;
  compact?: boolean;
};

export function MenuGrid({
  items,
  cart,
  onItemClick,
  onQuantityChange,
  onRemove,
  compact = false,
}: MenuGridProps) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-3"}`}>
      {items.map((item) => {
        const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);
        const cartQty = cart
          .filter((c) => c.menuItemId === item.id)
          .reduce((sum, c) => sum + c.quantity, 0);
        const cartItem = cart.find((c) => c.menuItemId === item.id);
        const inCart = cartQty > 0;

        return (
          <button
            key={item.id}
            type="button"
            className="text-left"
            onClick={() => {
              if (!isSoldOut && !inCart) {
                onItemClick(item);
              }
            }}
            disabled={isSoldOut && !inCart}
          >
            <Card
              className={`h-full transition-all duration-200 ${
                isSoldOut ? "opacity-60" : "hover:shadow-md"
              } ${inCart ? "ring-2 ring-primary ring-offset-1 lg:ring-offset-2" : ""}`}
            >
              <CardContent className={`flex flex-col gap-2 ${compact ? "p-2" : "p-2 lg:p-4 lg:gap-3"}`}>
                <div className="space-y-0.5 lg:space-y-1">
                  <div className={`font-semibold line-clamp-2 ${compact ? "text-sm" : "text-sm lg:text-base"}`}>
                    {item.name}
                  </div>
                  <div className={`text-primary font-bold ${compact ? "text-base" : "text-base lg:text-lg"}`}>
                    ¥{Number(item.price).toLocaleString()}
                  </div>
                  {isSoldOut && (
                    <Badge variant="secondary" className="text-xs">売切れ</Badge>
                  )}
                </div>
                {cartItem && onQuantityChange && onRemove && (
                  <div className="flex items-center justify-between gap-1 lg:gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="icon"
                      className={`rounded-full ${compact ? "h-8 w-8" : "h-8 w-8 lg:h-10 lg:w-10"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (cartQty === 1) {
                          onRemove(item.id);
                        } else {
                          onQuantityChange(item.id, -1);
                        }
                      }}
                    >
                      {cartQty === 1 ? (
                        <Trash2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-red-500" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                      )}
                    </Button>
                    <div className={`text-center font-bold ${compact ? "text-base" : "text-base lg:text-lg"}`}>
                      {cartQty}点
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className={`rounded-full ${compact ? "h-8 w-8" : "h-8 w-8 lg:h-10 lg:w-10"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuantityChange(item.id, 1);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
