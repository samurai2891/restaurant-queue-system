import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

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
  const storeIdNum = Number.parseInt(storeId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();

  const [partyMode, setPartyMode] = useState<"existing" | "new">("existing");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartySize, setNewPartySize] = useState("2");
  const [notes, setNotes] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

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

  const filteredItems = useMemo(() => {
    const list = (items as MenuItem[] | undefined) ?? [];
    if (activeCategory === "all") return list;
    const catId = Number.parseInt(activeCategory, 10);
    return list.filter((item) => item.categoryId === catId);
  }, [items, activeCategory]);

  const isSubmitting = createPartyMutation.isPending || createOrderMutation.isPending;
  const partySizeNumber = Number.parseInt(newPartySize, 10);
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
        partyId = Number.parseInt(selectedPartyId, 10);
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
        status: "served",
        routeToKitchen: false,
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>ログインが必要です</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/staff">
              <Button className="w-full">スタッフ入口へ</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>店舗が見つかりません</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ヘッダー */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href={`/queue/${storeIdNum}`}>
              <Button variant="ghost" size="icon" aria-label="戻る">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="leading-tight">
              <div className="font-semibold">注文受付</div>
              <div className="text-xs text-muted-foreground">{store.name}</div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchParties()}
          >
            再読込
          </Button>
        </div>
      </header>

      {/* メイン: PC=2カラム, スマホ=縦積み */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[320px_1fr] overflow-hidden">

          {/* 左カラム */}
          <div className="flex min-h-0 flex-col border-r bg-muted/10">
            {/* 注文先選択（固定高さ） */}
            <div className="shrink-0 p-4 space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">注文先</CardTitle>
                  <CardDescription>誰の注文として登録しますか</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={partyMode === "existing" ? "default" : "outline"}
                      onClick={() => setPartyMode("existing")}
                    >
                      既存受付
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={partyMode === "new" ? "default" : "outline"}
                      onClick={() => setPartyMode("new")}
                    >
                      新規受付
                    </Button>
                  </div>

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
                    <div className="space-y-3">
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
            </div>

            {/* カート詳細（PCのみ・スクロール可能） */}
            <div className="hidden lg:flex flex-1 min-h-0 flex-col px-4 pb-4">
              <Card className="flex flex-1 min-h-0 flex-col">
                <CardHeader className="shrink-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
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
                      </div>
                    )}
                  </ScrollArea>

                  {cart.length > 0 && (
                    <div className="shrink-0 pt-4 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="orderNotes">備考（任意）</Label>
                        <Textarea
                          id="orderNotes"
                          placeholder="アレルギーや特別なリクエストなど"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          rows={2}
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>小計</span>
                        <span>¥{totalAmount.toLocaleString()}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={clearCart}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        カートをクリア
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 右カラム */}
          <div className="flex min-h-0 flex-col">
            {/* カテゴリタブ（固定） */}
            <div className="shrink-0 p-4 border-b">
              <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                <ScrollArea className="w-full">
                  <TabsList className="inline-flex h-auto p-1 bg-muted/50">
                    <TabsTrigger
                      value="all"
                      className="rounded-full px-5 py-3 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white"
                    >
                      すべて
                    </TabsTrigger>
                    {categories?.map((c) => (
                      <TabsTrigger
                        key={c.id}
                        value={String(c.id)}
                        className="rounded-full px-5 py-3 whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white"
                      >
                        {c.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </ScrollArea>
              </Tabs>
            </div>

            {/* メニューグリッド（スクロール可能） */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredItems.map((item) => {
                    const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);
                    const cartItem = cart.find((c) => c.menuItemId === item.id);
                    const inCart = Boolean(cartItem);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="text-left"
                        onClick={() => {
                          if (!isSoldOut && !inCart) {
                            addToCart(item);
                          }
                        }}
                        disabled={isSoldOut && !inCart}
                      >
                        <Card
                          className={`h-full transition-all duration-200 ${
                            isSoldOut ? "opacity-60" : "hover:shadow-md"
                          } ${inCart ? "ring-2 ring-primary ring-offset-2" : ""}`}
                        >
                          <CardContent className="p-4 flex flex-col gap-3">
                            <div className="space-y-1">
                              <div className="font-semibold line-clamp-2">{item.name}</div>
                              <div className="text-lg text-primary font-bold">
                                ¥{Number(item.price).toLocaleString()}
                              </div>
                              {isSoldOut && (
                                <Badge variant="secondary">売切れ</Badge>
                              )}
                            </div>
                            {cartItem && (
                              <div className="flex items-center justify-between gap-2 pt-2 border-t">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (cartItem.quantity === 1) removeFromCart(cartItem.menuItemId);
                                    else updateQuantity(cartItem.menuItemId, -1);
                                  }}
                                >
                                  {cartItem.quantity === 1 ? (
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  ) : (
                                    <Minus className="h-4 w-4" />
                                  )}
                                </Button>
                                <div className="text-center font-bold text-lg">{cartItem.quantity}点</div>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-10 w-10 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateQuantity(cartItem.menuItemId, 1);
                                  }}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </button>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* 下部固定バー */}
      <Sheet>
        <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-3 px-4 py-3">
            {/* スマホ: カート概要（タップでSheet表示） */}
            <SheetTrigger asChild className="lg:hidden flex-1">
              <button
                type="button"
                className="flex flex-col items-start gap-1 rounded-lg p-2 text-left hover:bg-muted/40"
              >
                <span className="text-xs text-muted-foreground">タップしてカートを確認</span>
                <span className="text-base font-bold">
                  {totalItems}点 · ¥{totalAmount.toLocaleString()}
                </span>
              </button>
            </SheetTrigger>

            {/* PC: 合計表示 */}
            <div className="hidden lg:flex flex-1 items-center gap-4">
              <span className="text-muted-foreground">合計</span>
              <span className="text-xl font-bold">
                {totalItems}点 · ¥{totalAmount.toLocaleString()}
              </span>
            </div>

            <Button
              variant="outline"
              className="h-12"
              onClick={clearCart}
              disabled={cart.length === 0 || isSubmitting}
            >
              クリア
            </Button>
            <Button
              className="h-12 px-6"
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
          </div>
        </div>

        {/* スマホ用カート詳細Sheet */}
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-0 pb-6">
          <SheetHeader className="border-b px-4">
            <SheetTitle>カート</SheetTitle>
            <SheetDescription>注文内容を確認できます</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 h-full px-4 pt-4">
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
                    <Label htmlFor="orderNotesMobile">備考（任意）</Label>
                    <Textarea
                      id="orderNotesMobile"
                      placeholder="アレルギーや特別なリクエストなど"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={3}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between text-sm font-medium">
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
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
