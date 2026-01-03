import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [partyMode, setPartyMode] = useState<"existing" | "new">("existing");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartySize, setNewPartySize] = useState("2");
  const [notes, setNotes] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const hasInitializedSelection = useRef(false);

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

  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = trpc.order.list.useQuery(
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
  const confirmPaymentBatchMutation = trpc.order.confirmPaymentBatch.useMutation();

  const availableParties = useMemo(
    () =>
      (parties as PartyOption[] | undefined)?.filter(
        (party) => party.status === "waiting" || party.status === "arrived"
      ) ?? [],
    [parties]
  );

  const unpaidOrders = useMemo(
    () => (orders ?? []).filter((order) => order.paymentStatus === "unpaid"),
    [orders]
  );

  const selectedOrders = useMemo(
    () => unpaidOrders.filter((order) => selectedOrderIds.includes(order.id)),
    [unpaidOrders, selectedOrderIds]
  );

  const selectedOrderTotal = useMemo(
    () => selectedOrders.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0),
    [selectedOrders]
  );

  useEffect(() => {
    const unpaidOrderIds = unpaidOrders.map((order) => order.id);
    setSelectedOrderIds((current) => {
      if (!hasInitializedSelection.current) {
        hasInitializedSelection.current = true;
        return unpaidOrderIds;
      }
      return current.filter((orderId) => unpaidOrderIds.includes(orderId));
    });

    if (unpaidOrderIds.length === 0) {
      hasInitializedSelection.current = false;
    }
  }, [unpaidOrders]);

  const filteredItems = items?.filter((item: MenuItem) => {
    if (activeCategory === "all") return true;
    return item.categoryId === parseInt(activeCategory, 10);
  }) || [];

  const isSubmitting = createPartyMutation.isPending || createOrderMutation.isPending;
  const isPaymentSubmitting = confirmPaymentBatchMutation.isPending;
  const partySizeNumber = parseInt(newPartySize, 10);
  const canSubmit = cart.length > 0 && (
    partyMode === "existing" ? Boolean(selectedPartyId) : partySizeNumber > 0
  );
  const canConfirmPayment = selectedOrderIds.length > 0 && selectedPaymentMethod.length > 0;
  const cartDetailContent = (
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
    </div>
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
        status: "served",
        routeToKitchen: false,
      });

      await refetchOrders();
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

  const handleConfirmPayment = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error("会計対象の注文を選択してください");
      return;
    }

    if (!selectedPaymentMethod) {
      toast.error("支払方法を選択してください");
      return;
    }

    try {
      await confirmPaymentBatchMutation.mutateAsync({
        storeId: storeIdNum,
        orderIds: selectedOrderIds,
        paymentMethod: selectedPaymentMethod,
      });

      toast.success("会計を確定しました");
      setSelectedOrderIds([]);
      await refetchOrders();
    } catch (error) {
      const message = error instanceof Error ? error.message : "会計確定に失敗しました";
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
    <div className="space-y-6 pb-28 lg:pb-0">
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

      <Card className="hidden lg:block lg:sticky lg:top-4 z-20 shadow-md">
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

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[2fr_1fr]">
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
                      className="rounded-full px-5 py-3 text-base sm:px-4 sm:py-2 sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-white"
                    >
                      すべて
                    </TabsTrigger>
                    {categories?.map((category: Category) => (
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
                      isSoldOut ? "opacity-60" : "hover:shadow-lg"
                    } ${inCart ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-2 flex-1">
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
                        <div className="flex items-center justify-end gap-3 min-w-[180px]">
                          {inCart && !isSoldOut ? (
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="w-12 h-12 rounded-full"
                                onClick={() => {
                                  if (cartItem?.quantity === 1) {
                                    removeFromCart(item.id);
                                  } else {
                                    updateQuantity(item.id, -1);
                                  }
                                }}
                              >
                                {cartItem?.quantity === 1 ? (
                                  <Trash2 className="w-5 h-5 text-red-500" />
                                ) : (
                                  <Minus className="w-5 h-5" />
                                )}
                              </Button>
                              <span className="w-10 text-center text-lg font-bold">
                                {cartItem?.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="w-12 h-12 rounded-full"
                                onClick={() => updateQuantity(item.id, 1)}
                              >
                                <Plus className="w-5 h-5" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="lg"
                              className="h-12 min-h-[44px] px-6 rounded-xl"
                              onClick={() => addToCart(item)}
                              disabled={isSoldOut}
                            >
                              <Plus className="w-5 h-5 mr-2" />
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

          <Card className="hidden lg:block">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                カート
              </CardTitle>
              <CardDescription>注文内容を確認できます</CardDescription>
            </CardHeader>
            <CardContent>{cartDetailContent}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>会計対象</CardTitle>
              <CardDescription>未精算の注文を選択して会計します</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>未精算注文</span>
                <Badge variant="outline">{unpaidOrders.length}件</Badge>
              </div>

              {ordersLoading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : unpaidOrders.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  未精算の注文はありません
                </div>
              ) : (
                <div className="space-y-3">
                  {unpaidOrders.map((order) => {
                    const isSelected = selectedOrderIds.includes(order.id);
                    const orderTotal = Number(order.totalAmount ?? 0);
                    const partyLabel = order.party
                      ? `${order.party.guestName ?? "お客様"} (${order.party.partySize}名)`
                      : "お客様";

                    return (
                      <label
                        key={order.id}
                        className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                      >
                        <Checkbox
                          className="mt-1"
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            setSelectedOrderIds((current) => {
                              if (checked) {
                                return Array.from(new Set([...current, order.id]));
                              }
                              return current.filter((orderId) => orderId !== order.id);
                            });
                          }}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">注文 #{order.orderNumber}</p>
                              <p className="font-medium">{partyLabel}</p>
                            </div>
                            <Badge variant="secondary">未精算</Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{order.items?.length ?? 0}品</span>
                            <span className="font-semibold text-foreground">
                              ¥{orderTotal.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between text-sm font-medium">
                <span>選択中合計</span>
                <span>¥{selectedOrderTotal.toLocaleString()}</span>
              </div>

              <div className="space-y-2">
                <Label>支払方法</Label>
                <RadioGroup
                  value={selectedPaymentMethod}
                  onValueChange={setSelectedPaymentMethod}
                  className="space-y-2"
                >
                  <label className="flex items-center gap-2 rounded-md border p-3">
                    <RadioGroupItem value="cash" id="cashier-payment-cash" />
                    <span className="text-sm font-medium">現金</span>
                    <Badge variant="secondary" className="ml-auto">推奨</Badge>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border p-3">
                    <RadioGroupItem value="card" id="cashier-payment-card" />
                    <span className="text-sm font-medium">クレジットカード</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-md border p-3">
                    <RadioGroupItem value="qr" id="cashier-payment-qr" />
                    <span className="text-sm font-medium">QR決済</span>
                  </label>
                </RadioGroup>
              </div>

              <Button
                className="w-full"
                onClick={handleConfirmPayment}
                disabled={!canConfirmPayment || isPaymentSubmitting || ordersLoading}
              >
                {isPaymentSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    会計確定中...
                  </>
                ) : (
                  "会計を確定"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet>
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <SheetTrigger asChild>
              <button type="button" className="flex flex-1 flex-col items-start gap-1 rounded-lg p-2 text-left hover:bg-muted/40">
                <span className="text-xs text-muted-foreground">タップしてカートを確認</span>
                <span className="text-base font-bold">
                  {totalItems}点 · ¥{totalAmount.toLocaleString()}
                </span>
              </button>
            </SheetTrigger>
            <Button
              size="lg"
              className="h-12 px-6"
              onClick={handleSubmitOrder}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  処理中
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
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-0 pb-6">
          <SheetHeader className="border-b">
            <SheetTitle>カート</SheetTitle>
            <SheetDescription>注文内容を確認できます</SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-4">
            {cartDetailContent}
          </ScrollArea>
        </SheetContent>
      </Sheet>

    </div>
  );
}
