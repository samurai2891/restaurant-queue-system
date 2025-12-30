import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft,
  Loader2,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle,
  ImageIcon,
  ChefHat
} from "lucide-react";
import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { toast } from "sonner";

interface CartItem {
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
}

export default function GuestMenu() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const [, setLocation] = useLocation();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notes, setNotes] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isOrderComplete, setIsOrderComplete] = useState(false);

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

  const createOrderMutation = trpc.order.create.useMutation({
    onSuccess: () => {
      setIsOrderComplete(true);
      setCart([]);
      setNotes("");
      toast.success("注文を送信しました");
    },
    onError: (error: { message: string }) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const addToCart = (item: { id: number; name: string; price: number }) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) {
        return prev.map(c => 
          c.menuItemId === item.id 
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
    toast.success(`${item.name}をカートに追加しました`);
  };

  const updateQuantity = (menuItemId: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.menuItemId === menuItemId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const removeFromCart = (menuItemId: number) => {
    setCart(prev => prev.filter(item => item.menuItemId !== menuItemId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

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

  if (statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!status || !status.canOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <ChefHat className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">事前注文はご利用いただけません</p>
            <p className="text-sm text-muted-foreground mt-2">
              順番が近づくと注文可能になります
            </p>
            <Link href={`/guest/status/${accessToken}`}>
              <Button className="mt-4">順番確認に戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isOrderComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle>注文完了</CardTitle>
            <CardDescription>
              ご注文ありがとうございます。着席後にお届けします。
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href={`/guest/status/${accessToken}`}>
              <Button className="w-full">順番確認に戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container flex h-14 items-center justify-between">
          <Link href={`/guest/status/${accessToken}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="font-bold">メニュー</h1>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart className="w-5 h-5" />
            {totalItems > 0 && (
              <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs">
                {totalItems}
              </Badge>
            )}
          </Button>
        </div>
      </header>

      <main className="container py-4">
        {/* Categories & Items */}
        {categories?.map((category: { id: number; name: string }) => {
          const categoryItems = items?.filter((item: { categoryId: number }) => item.categoryId === category.id) || [];
          if (categoryItems.length === 0) return null;

          return (
            <div key={category.id} className="mb-8">
              <h2 className="text-lg font-bold mb-4">{category.name}</h2>
              <div className="space-y-3">
                {categoryItems.map((item: { id: number; name: string; description: string | null; price: string; imageUrl: string | null; isAvailable: boolean }) => (
                  <Card key={item.id} className={!item.isAvailable ? 'opacity-50' : ''}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                          {item.imageUrl ? (
                            <img 
                              src={item.imageUrl} 
                              alt={item.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-lg font-bold text-primary">
                              ¥{item.price.toLocaleString()}
                            </p>
                            {item.isAvailable ? (
                              <Button 
                                size="sm"
                                onClick={() => addToCart({ id: item.id, name: item.name, price: Number(item.price) })}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                追加
                              </Button>
                            ) : (
                              <Badge variant="secondary">売切れ</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </main>

      {/* Cart Footer */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4">
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            カートを見る ({totalItems}点) - ¥{totalAmount.toLocaleString()}
          </Button>
        </div>
      )}

      {/* Cart Dialog */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>カート</DialogTitle>
            <DialogDescription>
              注文内容をご確認ください
            </DialogDescription>
          </DialogHeader>
          
          {cart.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              カートは空です
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                {cart.map(item => (
                  <div key={item.menuItemId} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ¥{item.price.toLocaleString()} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="w-8 h-8"
                        onClick={() => updateQuantity(item.menuItemId, -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="w-8 h-8"
                        onClick={() => updateQuantity(item.menuItemId, 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">備考（任意）</label>
                <Textarea
                  placeholder="アレルギーや特別なリクエストなど"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>合計</span>
                  <span>¥{totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCartOpen(false)}>
              戻る
            </Button>
            <Button 
              onClick={handleSubmitOrder}
              disabled={cart.length === 0 || createOrderMutation.isPending}
            >
              {createOrderMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  送信中...
                </>
              ) : (
                '注文を送信'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
