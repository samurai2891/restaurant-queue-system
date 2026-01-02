import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMenuCart, type MenuItem } from "@/hooks/useMenuCart";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

interface Category {
  id: number;
  name: string;
  description?: string | null;
}

type PartyStatus = "waiting" | "notified" | "arrived" | "seated" | "canceled" | "noshow";

type PartyOption = {
  id: number;
  ticketNumber: number;
  guestName?: string | null;
  partySize: number;
  status: PartyStatus;
};

export default function Cashier() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();

  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [partyMode, setPartyMode] = useState<"existing" | "new">("existing");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartySize, setNewPartySize] = useState("2");
  const [notes, setNotes] = useState("");

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: categories } = trpc.menu.categories.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: items } = trpc.menu.items.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: parties, refetch: refetchParties } = trpc.party.list.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0, refetchInterval: 5000 }
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

  const createPartyMutation = trpc.party.create.useMutation();
  const createOrderMutation = trpc.order.createByStaff.useMutation();

  const availableParties = useMemo(
    () =>
      (parties as PartyOption[] | undefined)?.filter(
        (party) => party.status === "waiting" || party.status === "arrived"
      ) ?? [],
    [parties]
  );

  const filteredItems = items?.filter((item: MenuItem) => {
    if (activeCategory === "all") return true;
    return item.categoryId === parseInt(activeCategory, 10);
  }) || [];

  const isSubmitting = createPartyMutation.isPending || createOrderMutation.isPending;
  const partySizeNumber = parseInt(newPartySize, 10);
  const canSubmit = cart.length > 0 && (
    partyMode === "existing" ? Boolean(selectedPartyId) : partySizeNumber > 0
  );

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error("カートが空です");
      return;
    }

    let partyId: number | null = null;

    try {
      if (partyMode === "existing") {
        if (!selectedPartyId) {
          toast.error("注文先の受付を選択してください");
          return;
        }
        partyId = parseInt(selectedPartyId, 10);
      } else {
        if (!partySizeNumber || partySizeNumber < 1) {
          toast.error("人数を入力してください");
          return;
        }
        const createdParty = await createPartyMutation.mutateAsync({
          storeId: storeIdNum,
          guestName: newPartyName || undefined,
          partySize: partySizeNumber,
        });
        partyId = createdParty.id;
        refetchParties();
      }

      if (!partyId) {
        toast.error("受付情報の取得に失敗しました");
        return;
      }

      await createOrderMutation.mutateAsync({
        storeId: storeIdNum,
        partyId,
        items: cart.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        })),
        notes: notes || undefined,
      });

      toast.success("注文を確定しました");
      clearCart();
      setNotes("");

      if (partyMode === "new") {
        setPartyMode("existing");
        setSelectedPartyId(String(partyId));
        setNewPartyName("");
        setNewPartySize("2");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "注文の作成に失敗しました";
      toast.error(message);
    }
  };

  if (authLoading || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/queue/${storeIdNum}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">注文受付</h1>
            <p className="text-sm text-muted-foreground">{store?.name ?? "店舗"}</p>
          </div>
        </div>
      </div>

      <Card className="sticky top-4 z-20 shadow-md">
        <CardContent className="p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-sm text-muted-foreground">合計点数</p>
              <p className="text-2xl font-bold">{totalItems}点</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">合計金額</p>
              <p className="text-2xl font-bold text-primary">¥{totalAmount.toLocaleString()}</p>
            </div>
          </div>
          <Button
            size="lg"
            className="h-12 px-8"
            onClick={handleSubmitOrder}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                処理中...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                注文確定
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>カテゴリ</CardTitle>
              <CardDescription>メニューを絞り込みます</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
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
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {filteredItems.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <UtensilsCrossed className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">メニューがありません</p>
                </CardContent>
              </Card>
            ) : (
              filteredItems.map((item: MenuItem) => {
                const cartItem = cart.find((c) => c.menuItemId === item.id);
                const inCart = !!cartItem;
                const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);

                return (
                  <Card
                    key={item.id}
                    className={`overflow-hidden transition-all duration-200 ${
                      isSoldOut ? "opacity-60" : "hover:shadow-lg cursor-pointer"
                    } ${inCart ? "ring-2 ring-primary ring-offset-2" : ""}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                            {isSoldOut ? (
                              <Badge variant="secondary">売切れ</Badge>
                            ) : item.stockCount !== null ? (
                              <Badge variant="outline" className="text-xs">
                                残り{item.stockCount}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                在庫あり
                              </Badge>
                            )}
                          </div>
                        </div>
                        {!isSoldOut && (
                          <Button
                            size="lg"
                            className="h-12 px-6 rounded-xl"
                            onClick={(event) => {
                              event.stopPropagation();
                              addToCart(item);
                            }}
                          >
                            <Plus className="w-5 h-5 mr-2" />
                            追加
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>注文先</CardTitle>
              <CardDescription>誰の注文として登録しますか</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={partyMode} onValueChange={(value) => setPartyMode(value as "existing" | "new")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">既存受付</TabsTrigger>
                  <TabsTrigger value="new">新規受付</TabsTrigger>
                </TabsList>
              </Tabs>

              {partyMode === "existing" ? (
                <div className="space-y-2">
                  <Label>受付を選択</Label>
                  <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="受付を選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableParties.length === 0 && (
                        <SelectItem value="no-parties" disabled>
                          対象の受付がありません
                        </SelectItem>
                      )}
                      {availableParties.map((party) => (
                        <SelectItem key={party.id} value={party.id.toString()}>
                          #{party.ticketNumber} {party.guestName ?? "お客様"} ({party.partySize}名)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="guestName">お名前（任意）</Label>
                    <Input
                      id="guestName"
                      value={newPartyName}
                      onChange={(event) => setNewPartyName(event.target.value)}
                      placeholder="例: 山田様"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="partySize">人数</Label>
                    <Input
                      id="partySize"
                      type="number"
                      min={1}
                      value={newPartySize}
                      onChange={(event) => setNewPartySize(event.target.value)}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                カート
              </CardTitle>
              <CardDescription>注文内容を確認できます</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

                  <div className="pt-2 space-y-2">
                    <Label htmlFor="orderNotes">備考（任意）</Label>
                    <Textarea
                      id="orderNotes"
                      placeholder="アレルギーや特別なリクエストなど"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
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
                <Button variant="outline" className="w-full" onClick={clearCart}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  カートをクリア
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {selectedItem && (
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold">{selectedItem.name}</h2>
                <p className="text-2xl font-bold text-primary mt-2">
                  ¥{Number(selectedItem.price).toLocaleString()}
                </p>
                {selectedItem.stockCount !== null && (
                  <div className="mt-3 text-sm text-muted-foreground">
                    {selectedItem.stockCount > 0 ? `残り${selectedItem.stockCount}点` : "現在売切れです"}
                  </div>
                )}
              </div>
              {selectedItem.isAvailable && (selectedItem.stockCount === null || selectedItem.stockCount > 0) && (
                <Button
                  className="w-full h-12 text-lg rounded-xl"
                  onClick={() => {
                    addToCart(selectedItem);
                    setSelectedItem(null);
                  }}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  カートに追加
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
