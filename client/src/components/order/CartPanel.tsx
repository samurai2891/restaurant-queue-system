import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Minus, Trash2, ShoppingCart } from "lucide-react";
import type { CartItem, SelectedModifier } from "@/hooks/useMenuCart";

type CartPanelProps = {
  cart: CartItem[];
  totalAmount: number;
  totalItems: number;
  notes?: string;
  onNotesChange?: (notes: string) => void;
  onQuantityChange: (menuItemId: number, delta: number, modifiers?: SelectedModifier[]) => void;
  onRemove: (menuItemId: number, modifiers?: SelectedModifier[]) => void;
  onClear: () => void;
  compact?: boolean;
  showNotes?: boolean;
};

export function CartPanel({
  cart,
  totalAmount,
  totalItems,
  notes = "",
  onNotesChange,
  onQuantityChange,
  onRemove,
  onClear,
  compact = false,
  showNotes = true,
}: CartPanelProps) {
  if (compact) {
    return (
      <div className="space-y-3">
        {cart.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
            カートは空です
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((item, index) => (
              <div
                key={`${item.menuItemId}-${index}`}
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-1">{item.name}</p>
                  <p className="text-sm text-primary font-bold">
                    ¥{(item.price * item.quantity).toLocaleString()}
                  </p>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.modifiers.map((mod) => (
                        <Badge key={mod.id} variant="secondary" className="text-xs">
                          {mod.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 rounded-full"
                    onClick={() => {
                      if (item.quantity === 1) {
                        onRemove(item.menuItemId, item.modifiers);
                      } else {
                        onQuantityChange(item.menuItemId, -1, item.modifiers);
                      }
                    }}
                  >
                    {item.quantity === 1 ? (
                      <Trash2 className="w-4 h-4 text-red-500" />
                    ) : (
                      <Minus className="w-4 h-4" />
                    )}
                  </Button>
                  <span className="w-8 text-center font-bold">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="w-8 h-8 rounded-full"
                    onClick={() => onQuantityChange(item.menuItemId, 1, item.modifiers)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.length > 0 && (
          <>
            {showNotes && onNotesChange && (
              <div className="space-y-2">
                <Label htmlFor="cart-notes">備考（任意）</Label>
                <Textarea
                  id="cart-notes"
                  placeholder="アレルギーや特別なリクエストなど"
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  rows={2}
                />
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between text-sm font-medium">
              <span>小計</span>
              <span>¥{totalAmount.toLocaleString()}</span>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={onClear}>
              <Trash2 className="w-4 h-4 mr-2" />
              カートをクリア
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <Card className="flex flex-1 min-h-0 flex-col">
      <CardHeader className="shrink-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingCart className="w-4 h-4" />
          カート
          <Badge variant="outline">{totalItems}点</Badge>
        </CardTitle>
        <CardDescription>注文内容を確認</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 min-h-0 flex-col">
        <ScrollArea className="flex-1 min-h-0 pr-2">
          {cart.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              カートは空です
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, index) => (
                <div
                  key={`${item.menuItemId}-${index}`}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-1">{item.name}</p>
                    <p className="text-sm text-primary font-bold">
                      ¥{(item.price * item.quantity).toLocaleString()}
                    </p>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.modifiers.map((mod) => (
                          <Badge key={mod.id} variant="secondary" className="text-xs">
                            {mod.name} ×{mod.quantity}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8 rounded-full"
                      onClick={() => {
                        if (item.quantity === 1) {
                          onRemove(item.menuItemId, item.modifiers);
                        } else {
                          onQuantityChange(item.menuItemId, -1, item.modifiers);
                        }
                      }}
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="w-4 h-4 text-red-500" />
                      ) : (
                        <Minus className="w-4 h-4" />
                      )}
                    </Button>
                    <span className="w-8 text-center font-bold">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="w-8 h-8 rounded-full"
                      onClick={() => onQuantityChange(item.menuItemId, 1, item.modifiers)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {cart.length > 0 && (
          <div className="shrink-0 pt-4 space-y-3">
            {showNotes && onNotesChange && (
              <div className="space-y-2">
                <Label htmlFor="cart-notes-full">備考（任意）</Label>
                <Textarea
                  id="cart-notes-full"
                  placeholder="アレルギーや特別なリクエストなど"
                  value={notes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  rows={2}
                />
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between text-sm font-medium">
              <span>小計</span>
              <span>¥{totalAmount.toLocaleString()}</span>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={onClear}>
              <Trash2 className="w-4 h-4 mr-2" />
              カートをクリア
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
