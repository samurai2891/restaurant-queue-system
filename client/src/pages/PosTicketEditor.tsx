import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useMenuCart, type MenuItem } from "@/hooks/useMenuCart";
import { ArrowLeft, Loader2, Search, Plus, Minus, Trash2, Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";

type TicketPosStatus = "OPEN" | "MEMO_ONLY" | "ITEMIZED" | "PAYMENT_LOCKED" | "PAID" | "VOID";

export default function PosTicketEditor() {
  const { storeId, ticketId } = useParams<{ storeId: string; ticketId: string }>();
  const storeIdNum = Number.parseInt(storeId || "0", 10);
  const ticketIdNum = Number.parseInt(ticketId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [memoDraft, setMemoDraft] = useState("");

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: ticketData, isLoading: ticketLoading, refetch: refetchTicket } = trpc.ticket.get.useQuery(
    { storeId: storeIdNum, ticketId: ticketIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 && ticketIdNum > 0, refetchInterval: 5000 }
  );

  const { data: categories } = trpc.menu.categories.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: items } = trpc.menu.items.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const updateMetaMutation = trpc.ticket.updateMeta.useMutation({
    onSuccess: () => {
      toast.success("伝票情報を更新しました");
      refetchTicket();
    },
    onError: (error) => toast.error(error.message),
  });

  const markItemizedMutation = trpc.ticket.markItemized.useMutation({
    onSuccess: () => {
      toast.success("明細入力に切り替えました");
      refetchTicket();
    },
    onError: (error) => toast.error(error.message),
  });

  const addItemsMutation = trpc.ticket.addItemsToTicket.useMutation({
    onSuccess: () => {
      toast.success("明細を追加しました");
      clearCart();
      refetchTicket();
    },
    onError: (error) => toast.error(error.message),
  });

  const lockMutation = trpc.ticket.lockForPayment.useMutation({
    onSuccess: () => setLocation(`/pos/${storeIdNum}/tickets/${ticketIdNum}/pay`),
    onError: (error) => toast.error(error.message),
  });

  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalAmount: draftTotalAmount,
    totalItems: draftTotalItems,
  } = useMenuCart(items as MenuItem[] | undefined);

  const filteredItems = useMemo(() => {
    const list = (items as MenuItem[] | undefined) ?? [];
    let results = list;
    if (activeCategory !== "all") {
      const catId = Number.parseInt(activeCategory, 10);
      results = results.filter((i) => i.categoryId === catId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter((i) => i.name.toLowerCase().includes(q));
    }
    return results;
  }, [items, activeCategory, searchQuery]);

  const ticket = ticketData?.ticket;
  const unpaidOrders = ticketData?.orders ?? [];
  const persistedTotalAmount = ticketData?.totals.totalAmount ?? 0;
  const persistedTotalItems = ticketData?.totals.totalItems ?? 0;
  const combinedTotal = persistedTotalAmount + draftTotalAmount;
  const combinedItems = persistedTotalItems + draftTotalItems;

  const posEnabled = Boolean(store?.enablePosV2UI);
  const posStatus = (ticket?.posStatus ?? "OPEN") as TicketPosStatus;
  const isLocked = posStatus === "PAYMENT_LOCKED";
  const isMemoOnly = posStatus === "MEMO_ONLY";

  useEffect(() => {
    setMemoDraft(ticket?.memoText ?? "");
  }, [ticket?.memoText]);

  const handleSaveDraft = async () => {
    if (cart.length === 0) {
      toast.error("追加明細がありません");
      return;
    }
    await addItemsMutation.mutateAsync({
      storeId: storeIdNum,
      ticketId: ticketIdNum,
      items: cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
      })),
      entrySource: "staff_register",
      routeToKitchen: true,
    });
  };

  const handleGoPayment = async () => {
    if (isMemoOnly) {
      toast.error("メモ伝票は明細入力後に会計できます");
      return;
    }

    if (cart.length > 0) {
      await handleSaveDraft();
    }

    lockMutation.mutate({
      storeId: storeIdNum,
      ticketId: ticketIdNum,
    });
  };

  if (authLoading || storeLoading || ticketLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
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

  if (!store || !ticket || !posEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>POS新UIが利用できません</CardTitle>
            <CardDescription>
              店舗設定で `enablePosV2UI` を有効にしてください。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link href={`/pos/${storeIdNum}/tickets`} className="flex-1">
              <Button variant="outline" className="w-full">伝票一覧へ</Button>
            </Link>
            <Link href={`/settings/${storeIdNum}`} className="flex-1">
              <Button className="w-full">店舗設定へ</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href={`/pos/${storeIdNum}/tickets`}>
              <Button variant="ghost" size="icon" aria-label="伝票一覧へ">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="leading-tight">
              <div className="font-semibold">
                伝票 #{ticket.ticketNumber}
                <span className="text-sm text-muted-foreground">（{ticket.partySize}名）</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {ticket.tableLabel ? `テーブル: ${ticket.tableLabel}` : "テーブル未設定"}
              </div>
            </div>
            <Badge variant="outline" className="ml-2">{ticket.posStatus}</Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = window.prompt("テーブル名（例: T-12）", ticket.tableLabel ?? "");
                if (next === null) return;
                updateMetaMutation.mutate({
                  storeId: storeIdNum,
                  ticketId: ticketIdNum,
                  tableLabel: next.trim() ? next.trim() : null,
                });
              }}
              disabled={isLocked || updateMetaMutation.isPending}
            >
              <Pencil className="w-4 h-4 mr-2" />
              伝票編集
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation(`/pos/${storeIdNum}/tickets/${ticketIdNum}/pay`)}
              disabled={ticket.posStatus !== "PAYMENT_LOCKED"}
            >
              会計画面へ
            </Button>
          </div>
        </div>
      </header>

      {/* Body: Airレジ風の2カラム */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-0">
        {/* Left: 明細 */}
        <div className="border-r bg-muted/10">
          <div className="p-4 space-y-4">
            {isMemoOnly && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">メモ伝票</CardTitle>
                  <CardDescription>明細入力に切り替えるまで会計できません。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">メモ</div>
                    <Textarea
                      value={memoDraft}
                      onChange={(e) => setMemoDraft(e.target.value)}
                      placeholder="口頭メモを入力（例: 焼き加減、アレルギーなど）"
                      rows={4}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => updateMetaMutation.mutate({
                      storeId: storeIdNum,
                      ticketId: ticketIdNum,
                      memoText: memoDraft,
                    })}
                    disabled={updateMetaMutation.isPending}
                  >
                    メモを保存
                  </Button>
                  <Button
                    className="w-full"
                    onClick={() => markItemizedMutation.mutate({ storeId: storeIdNum, ticketId: ticketIdNum })}
                    disabled={markItemizedMutation.isPending}
                  >
                    明細入力に切り替える
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  明細
                  <Badge variant="outline">{combinedItems}点</Badge>
                </CardTitle>
                <CardDescription>未精算の明細（＋追加分）</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[50vh] pr-3">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">未精算（既存）</div>
                      {unpaidOrders.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-2">未精算明細はありません</div>
                      ) : (
                        unpaidOrders.flatMap((order) =>
                          (order.items ?? []).map((item) => (
                            <div key={`p-${order.id}-${item.id}`} className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium line-clamp-1">
                                  {item.menuItem?.name ?? `商品#${item.menuItemId}`}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  x{item.quantity} · ¥{Number(item.subtotal ?? 0).toLocaleString()}
                                </div>
                              </div>
                              <Badge variant="secondary">確定済</Badge>
                            </div>
                          ))
                        )
                      )}
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">追加（未保存）</div>
                      {cart.length === 0 ? (
                        <div className="text-sm text-muted-foreground py-2">追加はありません</div>
                      ) : (
                        cart.map((c) => (
                          <div key={`d-${c.menuItemId}`} className="flex items-center justify-between gap-3 rounded-lg border bg-background p-2">
                            <div className="min-w-0">
                              <div className="font-medium line-clamp-1">{c.name}</div>
                              <div className="text-xs text-muted-foreground">
                                ¥{(c.price * c.quantity).toLocaleString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-full"
                                onClick={() => {
                                  if (c.quantity === 1) removeFromCart(c.menuItemId);
                                  else updateQuantity(c.menuItemId, -1);
                                }}
                                disabled={isLocked}
                              >
                                {c.quantity === 1 ? (
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                ) : (
                                  <Minus className="h-4 w-4" />
                                )}
                              </Button>
                              <span className="w-8 text-center font-bold">{c.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-full"
                                onClick={() => updateQuantity(c.menuItemId, 1)}
                                disabled={isLocked}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </ScrollArea>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">既存合計</span>
                  <span className="font-semibold">¥{persistedTotalAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">追加合計</span>
                  <span className="font-semibold">¥{draftTotalAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-base">
                  <span className="font-semibold">合計（税込）</span>
                  <span className="text-xl font-bold text-primary">¥{combinedTotal.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right: 商品タイル */}
        <div className="p-4 space-y-4">
          {isLocked && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">会計中です</CardTitle>
                <CardDescription>他端末の編集を制限しています。</CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-2 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="商品名で検索..."
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              disabled={isLocked || isMemoOnly}
            />
          </div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <ScrollArea className="w-full">
              <TabsList className="inline-flex h-auto p-1 bg-muted/50">
                <TabsTrigger value="all" className="rounded-full px-5 py-3 data-[state=active]:bg-primary data-[state=active]:text-white">
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => {
              const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-xl border bg-background p-4 text-left shadow-sm transition hover:shadow-md ${
                    isSoldOut ? "opacity-60" : ""
                  }`}
                  onClick={() => addToCart(item)}
                  disabled={isSoldOut || isLocked || isMemoOnly}
                >
                  <div className="font-semibold line-clamp-2">{item.name}</div>
                  <div className="mt-2 text-lg font-bold text-primary">
                    ¥{Number(item.price).toLocaleString()}
                  </div>
                  <div className="mt-2">
                    {isSoldOut ? (
                      <Badge variant="secondary">売切れ</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">在庫あり</Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="sticky bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="text-sm text-muted-foreground">
            追加 {draftTotalItems}点 · ¥{draftTotalAmount.toLocaleString()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-12 px-6"
              onClick={handleSaveDraft}
              disabled={cart.length === 0 || isLocked || isMemoOnly || addItemsMutation.isPending}
            >
              一時保存
            </Button>
            <Button
              className="h-12 px-8"
              onClick={handleGoPayment}
              disabled={isLocked || isMemoOnly || lockMutation.isPending}
            >
              支払いへ進む
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


