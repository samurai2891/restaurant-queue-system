import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MenuImage } from "@/components/MenuImage";
import type { CartItem, MenuItem } from "@/hooks/useMenuCart";
import { Minus, Plus, Search, Trash2, UtensilsCrossed } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type Category = {
  id: number;
  name: string;
  description?: string | null;
};

type CartDetailContentProps = {
  cart: CartItem[];
  notes: string;
  totalAmount: number;
  onNotesChange: (value: string) => void;
  onUpdateQuantity: (menuItemId: number, delta: number) => void;
  onRemoveFromCart: (menuItemId: number) => void;
  onClearCart: () => void;
};

export const CartDetailContent = ({
  cart,
  notes,
  totalAmount,
  onNotesChange,
  onUpdateQuantity,
  onRemoveFromCart,
  onClearCart,
}: CartDetailContentProps) => (
  <div className="space-y-4">
    {cart.length === 0 ? (
      <div className="text-center py-6 text-muted-foreground">
        カートは空です
      </div>
    ) : (
      <div className="space-y-3">
        {cart.map((item) => (
          <div key={item.menuItemId} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="font-medium line-clamp-1">{item.name}</p>
              <p className="text-sm text-primary font-bold">
                ¥{(item.price * item.quantity).toLocaleString()}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="w-8 h-8 rounded-full"
                onClick={() => {
                  if (item.quantity === 1) {
                    onRemoveFromCart(item.menuItemId);
                  } else {
                    onUpdateQuantity(item.menuItemId, -1);
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
                onClick={() => onUpdateQuantity(item.menuItemId, 1)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}

        <div className="pt-2 space-y-2">
          <Label htmlFor="orderNotes">備考（任意）</Label>
          <Textarea
            id="orderNotes"
            placeholder="アレルギーや特別なリクエストなど"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between pt-2 text-sm font-medium">
          <span>小計</span>
          <span>¥{totalAmount.toLocaleString()}</span>
        </div>
      </div>
    )}

    {cart.length > 0 && (
      <Button variant="outline" className="w-full" onClick={onClearCart}>
        <Trash2 className="w-4 h-4 mr-2" />
        カートをクリア
      </Button>
    )}
  </div>
);

type CartBuilderProps = {
  categories?: Category[];
  items?: MenuItem[];
  cart: CartItem[];
  totalAmount: number;
  totalItems: number;
  notes: string;
  onNotesChange: (value: string) => void;
  onAddToCart: (item: MenuItem) => void;
  onUpdateQuantity: (menuItemId: number, delta: number) => void;
  onRemoveFromCart: (menuItemId: number) => void;
  onClearCart: () => void;
  sidebarHeader?: ReactNode;
  sidebarFooter?: ReactNode;
};

export const CartBuilder = ({
  categories,
  items,
  cart,
  totalAmount,
  totalItems,
  notes,
  onNotesChange,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  onClearCart,
  sidebarHeader,
  sidebarFooter,
}: CartBuilderProps) => {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    if (!items) return [];
    let results = items;
    if (activeCategory !== "all") {
      results = results.filter((item) => item.categoryId === parseInt(activeCategory, 10));
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter((item) => item.name.toLowerCase().includes(query));
    }
    return results;
  }, [activeCategory, items, searchQuery]);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[220px_1fr_320px]">
      <div className="space-y-4">
        <Card className="lg:sticky lg:top-4">
          <CardHeader className="pb-2">
            <CardTitle>カテゴリ</CardTitle>
            <CardDescription>POSメニューの絞り込み</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-2">
                <Button
                  variant={activeCategory === "all" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveCategory("all")}
                >
                  すべて
                </Button>
                {categories?.map((category) => (
                  <Button
                    key={category.id}
                    variant={activeCategory === category.id.toString() ? "default" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveCategory(category.id.toString())}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:hidden">
          <CardHeader className="pb-2">
            <CardTitle>カテゴリ</CardTitle>
            <CardDescription>タップして切り替え</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                <TabsList className="inline-flex h-auto p-1 bg-muted/50">
                  <TabsTrigger
                    value="all"
                    className="rounded-full px-5 py-3 text-base sm:px-4 sm:py-2 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    すべて
                  </TabsTrigger>
                  {categories?.map((category) => (
                    <TabsTrigger
                      key={category.id}
                      value={category.id.toString()}
                      className="rounded-full px-5 py-3 text-base sm:px-4 sm:py-2 sm:text-sm whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white"
                    >
                      {category.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-muted/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-2 shadow-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="メニューを検索..."
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredItems.length === 0 ? (
            <Card className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
              <CardContent className="py-12 text-center">
                <UtensilsCrossed className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">メニューがありません</p>
              </CardContent>
            </Card>
          ) : (
            filteredItems.map((item) => {
              const cartItem = cart.find((c) => c.menuItemId === item.id);
              const inCart = !!cartItem;
              const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);

              return (
                <Card
                  key={item.id}
                  className={`overflow-hidden transition-all duration-200 ${
                    isSoldOut ? "opacity-60" : "hover:-translate-y-0.5 hover:shadow-lg"
                  } ${inCart ? "ring-2 ring-primary ring-offset-2" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      <div className="h-32 w-full overflow-hidden rounded-lg bg-muted/40">
                        <MenuImage
                          imageUrl={item.imageUrl}
                          name={item.name}
                          className="h-full w-full"
                          iconClassName="h-10 w-10"
                          labelClassName="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-base line-clamp-2">{item.name}</h3>
                          {inCart && (
                            <Badge className="bg-primary text-white">
                              {cartItem?.quantity}点
                            </Badge>
                          )}
                        </div>
                        <p className="text-xl font-bold text-primary">
                          ¥{Number(item.price).toLocaleString()}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          {isSoldOut && <Badge variant="secondary">売切れ</Badge>}
                          {!isSoldOut && item.stockCount !== null && (
                            <Badge variant="outline" className="text-xs">
                              残り{item.stockCount}
                            </Badge>
                          )}
                          {!isSoldOut && item.stockCount === null && (
                            <Badge variant="outline" className="text-xs">
                              在庫あり
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        {inCart && !isSoldOut ? (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="w-10 h-10 rounded-full"
                              onClick={() => {
                                if (cartItem?.quantity === 1) {
                                  onRemoveFromCart(item.id);
                                } else {
                                  onUpdateQuantity(item.id, -1);
                                }
                              }}
                            >
                              {cartItem?.quantity === 1 ? (
                                <Trash2 className="w-4 h-4 text-red-500" />
                              ) : (
                                <Minus className="w-4 h-4" />
                              )}
                            </Button>
                            <span className="w-8 text-center text-lg font-bold">
                              {cartItem?.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="w-10 h-10 rounded-full"
                              onClick={() => onUpdateQuantity(item.id, 1)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="lg"
                            className="h-11 min-h-[44px] flex-1 rounded-xl"
                            onClick={() => onAddToCart(item)}
                            disabled={isSoldOut}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            追加
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-4">
        {sidebarHeader}

        <Card className="hidden lg:block">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              カート
              <Badge variant="outline">{totalItems}点</Badge>
            </CardTitle>
            <CardDescription>注文内容を確認できます</CardDescription>
          </CardHeader>
          <CardContent>
            <CartDetailContent
              cart={cart}
              notes={notes}
              totalAmount={totalAmount}
              onNotesChange={onNotesChange}
              onUpdateQuantity={onUpdateQuantity}
              onRemoveFromCart={onRemoveFromCart}
              onClearCart={onClearCart}
            />
          </CardContent>
        </Card>

        {sidebarFooter}
      </div>
    </div>
  );
};
