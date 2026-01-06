import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MenuImage } from "@/components/MenuImage";
import { useMenuCart, type MenuItem } from "@/hooks/useMenuCart";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft,
  Loader2,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle,
  ChefHat,
  Clock,
  Trash2,
  UtensilsCrossed,
  Sparkles,
  Info,
  X
} from "lucide-react";
import { useState } from "react";
import { useParams, Link } from "wouter";
import { toast } from "sonner";

interface Category {
  id: number;
  name: string;
  description?: string | null;
}

export default function GuestMenu() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const [notes, setNotes] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderComplete, setIsOrderComplete] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data: status, isLoading: statusLoading } = trpc.party.guestStatus.useQuery(
    { accessToken: accessToken || "" },
    { enabled: !!accessToken }
  );

  const { data: categories } = trpc.menu.categories.useQuery(
    { storeId: status?.storeId || 0 },
    { enabled: !!status?.storeId }
  );

  const { data: items } = trpc.menu.items.useQuery(
    { storeId: status?.storeId || 0 },
    { enabled: !!status?.storeId }
  );

  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalAmount,
    totalItems,
  } = useMenuCart(items);

  const createOrderMutation = trpc.order.create.useMutation({
    onSuccess: () => {
      setIsOrderComplete(true);
      clearCart();
      setNotes("");
      setIsCartOpen(false);
      toast.success("注文を送信しました！");
    },
    onError: (error: { message: string }) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  // 注文送信
  const handleSubmitOrder = () => {
    if (cart.length === 0) {
      toast.error("カートが空です");
      return;
    }

    createOrderMutation.mutate({
      accessToken: accessToken || "",
      items: cart.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      })),
      notes: notes || undefined,
    });
  };

  // フィルタリングされたアイテム
  const filteredItems = items?.filter((item: MenuItem) => {
    if (activeCategory === "all") return true;
    return item.categoryId === parseInt(activeCategory);
  }) || [];

  // ローディング
  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">メニューを読み込んでいます...</p>
        </div>
      </div>
    );
  }

  // 注文可否の判定
  const canOrder = Boolean(status?.canOrder);

  // 注文完了画面
  if (isOrderComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">ご注文ありがとうございます！</CardTitle>
            <CardDescription className="text-base mt-2">
              着席後にお届けいたします
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">受付番号</p>
              <p className="text-3xl font-bold text-primary">{status?.ticketNumber}</p>
            </div>
            
            <div className="bg-amber-50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">ご注意</p>
                  <p className="text-sm text-amber-700 mt-1">
                    ご注文はスタッフが確認し、調理を開始します。
                    追加のご注文もこの画面から行えます。
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href={`/guest/status/${accessToken}`} className="flex-1">
                <Button variant="outline" className="w-full">
                  順番確認に戻る
                </Button>
              </Link>
              <Button 
                className="flex-1"
                onClick={() => setIsOrderComplete(false)}
              >
                追加注文する
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b shadow-sm">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href={`/guest/status/${accessToken}`}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          
          <div className="text-center">
            <h1 className="font-bold text-lg">{status?.storeName || "メニュー"}</h1>
            {status && (
              <p className="text-xs text-muted-foreground">
                受付番号: {status.ticketNumber}
              </p>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative rounded-full"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart className="w-5 h-5" />
            {totalItems > 0 && (
              <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs animate-pulse">
                {totalItems}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      {/* 事前注文バナー */}
      {canOrder && (
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white px-4 py-3">
          <div className="container flex items-center gap-3">
            <Sparkles className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">事前注文で待ち時間を有効活用！</p>
              <p className="text-xs opacity-90">着席後すぐにお料理をお届けします</p>
            </div>
          </div>
        </div>
      )}

      {/* 注文不可の場合のバナー */}
      {!canOrder && status && (
        <div className="bg-muted px-4 py-3">
          <div className="container flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium text-sm">メニュー閲覧モード</p>
              <p className="text-xs text-muted-foreground">
                順番が近づくと事前注文が可能になります
              </p>
            </div>
          </div>
        </div>
      )}

      {/* カテゴリータブ */}
      <div className="sticky top-16 z-40 bg-white/90 backdrop-blur-md border-b">
        <ScrollArea className="w-full">
          <div className="container px-4 py-2">
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="inline-flex h-auto p-1 bg-muted/50">
                <TabsTrigger 
                  value="all" 
                  className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  すべて
                </TabsTrigger>
                {categories?.map((category: Category) => (
                  <TabsTrigger 
                    key={category.id} 
                    value={category.id.toString()}
                    className="rounded-full px-4 py-2 text-sm whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </ScrollArea>
      </div>

      {/* メニューリスト */}
      <main className="container px-4 py-6 pb-32">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">メニューがありません</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredItems.map((item: MenuItem) => {
              const cartItem = cart.find(c => c.menuItemId === item.id);
              const inCart = !!cartItem;
              const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);

              return (
                <Card 
                  key={item.id} 
                  className={`overflow-hidden transition-all duration-200 ${
                    isSoldOut ? 'opacity-60' : 'hover:shadow-lg cursor-pointer'
                  } ${inCart ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  onClick={() => setSelectedItem(item)}
                >
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* 画像 */}
                      <div className="w-28 h-28 flex-shrink-0 relative">
                        <MenuImage
                          imageUrl={item.imageUrl}
                          name={item.name}
                          className="h-full w-full"
                          iconClassName="h-10 w-10"
                          labelClassName="text-sm"
                        />
                        {isSoldOut && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <Badge variant="secondary" className="bg-white">売切れ</Badge>
                          </div>
                        )}
                        {inCart && (
                          <div className="absolute top-2 left-2">
                            <Badge className="bg-primary text-white">
                              {cartItem.quantity}点
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* 情報 */}
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-base line-clamp-1">{item.name}</h3>
                          {item.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {item.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xl font-bold text-primary">
                            ¥{Number(item.price).toLocaleString()}
                          </p>
                          <div className="flex items-center gap-2">
                            {item.stockCount !== null && item.stockCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                残り{item.stockCount}
                              </Badge>
                            )}
                            {!isSoldOut && canOrder && (
                              <Button 
                                size="sm"
                                className="rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(item, {
                                    onActionClick: () => setIsCartOpen(true),
                                  });
                                }}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                追加
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* カートフッター */}
      {totalItems > 0 && canOrder && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50">
          <div className="container">
            <Button 
              className="w-full h-14 text-lg rounded-xl shadow-lg"
              size="lg"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              カートを確認 ({totalItems}点)
              <span className="ml-auto font-bold">¥{totalAmount.toLocaleString()}</span>
            </Button>
          </div>
        </div>
      )}

      {/* 商品詳細ダイアログ */}
      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {selectedItem && (
            <>
              {/* 画像 */}
              <div className="w-full h-48 relative">
                <MenuImage
                  imageUrl={selectedItem.imageUrl}
                  name={selectedItem.name}
                  className="h-full w-full rounded-none"
                  iconClassName="h-16 w-16"
                  labelClassName="text-lg"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-white/80 hover:bg-white rounded-full"
                  onClick={() => setSelectedItem(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="p-6">
                <h2 className="text-xl font-bold">{selectedItem.name}</h2>
                <p className="text-2xl font-bold text-primary mt-2">
                  ¥{Number(selectedItem.price).toLocaleString()}
                </p>

                {selectedItem.description && (
                  <p className="text-muted-foreground mt-4">
                    {selectedItem.description}
                  </p>
                )}

                {selectedItem.stockCount !== null && (
                  <div className="mt-4 text-sm text-muted-foreground">
                    {selectedItem.stockCount > 0 ? `残り${selectedItem.stockCount}点` : "現在売切れです"}
                  </div>
                )}

                {/* カートに追加ボタン */}
                {canOrder && selectedItem.isAvailable && (selectedItem.stockCount === null || selectedItem.stockCount > 0) && (
                  <Button 
                    className="w-full mt-6 h-12 text-lg rounded-xl"
                    onClick={() => {
                      addToCart(selectedItem, {
                        onActionClick: () => setIsCartOpen(true),
                      });
                      setSelectedItem(null);
                    }}
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    カートに追加
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* カートダイアログ */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">カート</DialogTitle>
              {cart.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground"
                  onClick={clearCart}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  クリア
                </Button>
              )}
            </div>
            <DialogDescription>
              注文内容をご確認ください
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 px-6">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">カートは空です</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => setIsCartOpen(false)}
                >
                  メニューを見る
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {cart.map(item => (
                  <div key={item.menuItemId} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    {/* サムネイル */}
                    <div className="w-16 h-16 flex-shrink-0 overflow-hidden rounded-lg">
                      <MenuImage
                        imageUrl={item.imageUrl}
                        name={item.name}
                        className="h-full w-full"
                        iconClassName="h-6 w-6"
                        labelClassName="text-xs"
                      />
                    </div>

                    {/* 情報 */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium line-clamp-1">{item.name}</p>
                      <p className="text-sm text-primary font-bold">
                        ¥{(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>

                    {/* 数量コントロール */}
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="w-8 h-8 rounded-full"
                        onClick={() => {
                          if (item.quantity === 1) {
                            removeFromCart(item.menuItemId);
                          } else {
                            updateQuantity(item.menuItemId, -1);
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
                        onClick={() => updateQuantity(item.menuItemId, 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* 備考欄 */}
                <div className="pt-4">
                  <label className="text-sm font-medium">備考（任意）</label>
                  <Textarea
                    placeholder="アレルギーや特別なリクエストなど"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-2"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </ScrollArea>

          {cart.length > 0 && (
            <div className="p-6 pt-0 border-t bg-white">
              {/* 合計 */}
              <div className="flex justify-between items-center py-4">
                <span className="text-lg">合計（税込）</span>
                <span className="text-2xl font-bold text-primary">
                  ¥{totalAmount.toLocaleString()}
                </span>
              </div>

              {/* 注文ボタン */}
              <Button 
                className="w-full h-14 text-lg rounded-xl"
                onClick={handleSubmitOrder}
                disabled={createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    注文を確定する
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground mt-3">
                着席後にお届けします。キャンセルはスタッフまで。
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
