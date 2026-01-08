import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useMenuCart, type MenuItem, type SelectedModifier } from "@/hooks/useMenuCart";
import { ToppingDialog, type ToppingDialogResult } from "@/components/order/ToppingDialog";
import { OrderNoteDialog } from "@/components/order/OrderNoteDialog";
import { ElapsedTimeCompact } from "@/components/order/ElapsedTime";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Minus,
  Trash2,
  Search,
  Users,
  Clock,
  AlertTriangle,
  Pencil,
  ArrowRightLeft,
  ShoppingCart,
  Send,
  ChefHat,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

type TicketOption = {
  id: number;
  ticketNumber: number;
  tableLabel?: string | null;
  guestName?: string | null;
  posStatus: string;
  partyKind: string;
  unpaidItemsCount?: number;
  unpaidTotalAmount?: number;
  seatedAt?: string | null;
  allergies?: string | null;
  notes?: string | null;
};

export default function HandheldOrder() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = Number.parseInt(storeId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();

  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [cartOpen, setCartOpen] = useState(false);

  // Topping Dialog
  const [toppingDialogOpen, setToppingDialogOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);

  // Order Note Dialog
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");

  // Table Correction Dialog
  const [tableCorrectionOpen, setTableCorrectionOpen] = useState(false);
  const [correctionTargetTicketId, setCorrectionTargetTicketId] = useState<string>("");

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: tickets, isLoading: ticketsLoading, refetch: refetchTickets } = trpc.ticket.list.useQuery(
    {
      storeId: storeIdNum,
      partyKind: "DINE_IN",
      search: ticketSearch.trim() || undefined,
    },
    { enabled: isAuthenticated && storeIdNum > 0, refetchInterval: 5000 }
  );

  const availableTickets = useMemo(() => {
    const list = (tickets as TicketOption[] | undefined) ?? [];
    return list.filter((t) => t.posStatus === "OPEN" || t.posStatus === "ITEMIZED");
  }, [tickets]);

  const selectedTicket = useMemo(() => {
    const id = Number.parseInt(selectedTicketId, 10);
    if (!Number.isFinite(id)) return undefined;
    return availableTickets.find((t) => t.id === id);
  }, [availableTickets, selectedTicketId]);

  const { data: categories } = trpc.menu.categories.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: items } = trpc.menu.items.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalAmount,
    totalItems,
  } = useMenuCart(items as MenuItem[] | undefined);

  const filteredItems = useMemo(() => {
    const list = (items as MenuItem[] | undefined) ?? [];
    let results = list;
    if (activeCategory !== "all") {
      const catId = Number.parseInt(activeCategory, 10);
      results = results.filter((i) => i.categoryId === catId);
    }
    return results;
  }, [items, activeCategory]);

  const addItemsMutation = trpc.ticket.addItemsToTicket.useMutation({
    onSuccess: () => {
      toast.success("注文を送信しました", {
        icon: <ChefHat className="w-5 h-5 text-green-500" />,
      });
      clearCart();
      setOrderNotes("");
      setCartOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const moveToTicketMutation = trpc.order.moveToTicket.useMutation({
    onSuccess: () => {
      toast.success("テーブルを訂正しました");
      setTableCorrectionOpen(false);
      refetchTickets();
    },
    onError: (e) => toast.error(e.message),
  });

  const canSubmit = Boolean(selectedTicketId) && cart.length > 0;
  const handheldEnabled = Boolean(store?.enableHandheld);

  // メニューアイテムをタップした時
  const handleMenuItemTap = (item: MenuItem) => {
    const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);
    if (isSoldOut) return;

    // トッピングがあるかチェック（簡易的に常にダイアログを表示）
    setSelectedMenuItem(item);
    setToppingDialogOpen(true);
  };

  // トッピング選択後
  const handleToppingConfirm = (result: ToppingDialogResult) => {
    if (!selectedMenuItem) return;
    addToCart(selectedMenuItem, {
      modifiers: result.modifiers,
      notes: result.notes,
      silent: false,
    });
    setSelectedMenuItem(null);
  };

  // 注文送信
  const handleSubmit = async () => {
    if (!selectedTicketId) {
      toast.error("伝票を選択してください");
      return;
    }
    if (cart.length === 0) {
      toast.error("カートが空です");
      return;
    }
    await addItemsMutation.mutateAsync({
      storeId: storeIdNum,
      ticketId: Number.parseInt(selectedTicketId, 10),
      items: cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        modifiers: c.modifiers,
        notes: c.notes,
      })),
      notes: orderNotes || undefined,
      entrySource: "staff_handheld",
      routeToKitchen: true,
    });
  };

  // テーブル訂正
  const handleTableCorrection = () => {
    if (!correctionTargetTicketId || !selectedTicketId) return;
    // 実際のorder移動は選択した注文に対して行う
    // この例では最新の注文を移動する想定
    toast.info("テーブル訂正機能は次の更新で実装予定です");
    setTableCorrectionOpen(false);
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

  if (!handheldEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>ハンディ機能が無効です</CardTitle>
            <CardDescription>
              店舗設定で「ハンディ」を有効にしてください。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link href="/staff" className="flex-1">
              <Button variant="outline" className="w-full">スタッフ入口へ</Button>
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
      {/* Topping Dialog */}
      <ToppingDialog
        open={toppingDialogOpen}
        onOpenChange={setToppingDialogOpen}
        menuItem={selectedMenuItem}
        onConfirm={handleToppingConfirm}
      />

      {/* Order Note Dialog */}
      <OrderNoteDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        ticketLabel={selectedTicket ? `#${selectedTicket.ticketNumber}` : undefined}
        initialNotes={orderNotes}
        initialAllergies=""
        onConfirm={(notes) => {
          setOrderNotes(notes);
        }}
      />

      {/* Table Correction Dialog */}
      <Dialog open={tableCorrectionOpen} onOpenChange={setTableCorrectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              テーブル訂正
            </DialogTitle>
            <DialogDescription>
              注文を別のテーブルに移動します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>移動先のテーブル</Label>
              <Select value={correctionTargetTicketId} onValueChange={setCorrectionTargetTicketId}>
                <SelectTrigger>
                  <SelectValue placeholder="移動先を選択" />
                </SelectTrigger>
                <SelectContent>
                  {availableTickets
                    .filter((t) => t.id.toString() !== selectedTicketId)
                    .map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        #{t.ticketNumber}
                        {t.tableLabel ? ` · ${t.tableLabel}` : ""}
                        {t.guestName ? ` · ${t.guestName}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTableCorrectionOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleTableCorrection} disabled={!correctionTargetTicketId}>
              訂正する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href="/staff">
              <Button variant="ghost" size="icon" aria-label="戻る">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="leading-tight">
              <div className="font-semibold">ハンディ注文</div>
              <div className="text-xs text-muted-foreground">{store.name}</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchTickets()} disabled={ticketsLoading}>
            更新
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        {/* テーブル選択セクション */}
        <div className="shrink-0 border-b p-3 space-y-3">
          {/* 検索 */}
          <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={ticketSearch}
              onChange={(e) => setTicketSearch(e.target.value)}
              placeholder="伝票番号 / テーブル / 顧客名"
              className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
          </div>

          {/* テーブルグリッド */}
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {ticketsLoading ? (
                <div className="flex items-center justify-center w-full py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : availableTickets.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center w-full py-4">
                  対象の伝票がありません
                </div>
              ) : (
                availableTickets.map((ticket) => {
                  const isSelected = selectedTicketId === String(ticket.id);
                  const hasItems = (ticket.unpaidItemsCount ?? 0) > 0;
                  
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicketId(String(ticket.id))}
                      className={`shrink-0 min-w-[120px] p-3 rounded-xl border-2 transition-all text-left ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-lg">#{ticket.ticketNumber}</span>
                        {ticket.allergies && (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      {ticket.tableLabel && (
                        <Badge variant="outline" className="mb-1">
                          {ticket.tableLabel}
                        </Badge>
                      )}
                      <div className="text-xs text-muted-foreground truncate">
                        {ticket.guestName || "お客様"}
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className={hasItems ? "text-primary font-medium" : "text-muted-foreground"}>
                          {ticket.unpaidItemsCount ?? 0}点
                        </span>
                        {ticket.seatedAt && (
                          <ElapsedTimeCompact startTime={ticket.seatedAt} thresholdMinutes={60} />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* 選択中のテーブル情報 */}
          {selectedTicket && (
            <Card className="bg-muted/30">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">#{selectedTicket.ticketNumber}</span>
                        {selectedTicket.tableLabel && (
                          <Badge variant="outline">{selectedTicket.tableLabel}</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {selectedTicket.guestName || "お客様"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTableCorrectionOpen(true)}
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-1" />
                      訂正
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNoteDialogOpen(true)}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      メモ
                    </Button>
                  </div>
                </div>
                {(selectedTicket.allergies || selectedTicket.notes) && (
                  <div className="mt-2 pt-2 border-t space-y-1">
                    {selectedTicket.allergies && (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span>アレルギー: {selectedTicket.allergies}</span>
                      </div>
                    )}
                    {selectedTicket.notes && (
                      <div className="text-sm text-muted-foreground">
                        備考: {selectedTicket.notes}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* カテゴリタブ */}
        <div className="shrink-0 border-b p-2">
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <ScrollArea className="w-full">
              <TabsList className="inline-flex h-auto p-1 bg-muted/50">
                <TabsTrigger
                  value="all"
                  className="rounded-full px-4 py-2 text-sm whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white"
                >
                  すべて
                </TabsTrigger>
                {categories?.map((c) => (
                  <TabsTrigger
                    key={c.id}
                    value={String(c.id)}
                    className="rounded-full px-4 py-2 text-sm whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white"
                  >
                    {c.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>
          </Tabs>
        </div>

        {/* メニューグリッド */}
        <ScrollArea className="flex-1">
          <div className="p-3">
            <div className="grid grid-cols-2 gap-3">
              {filteredItems.map((item) => {
                const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);
                const cartItem = cart.find((c) => c.menuItemId === item.id);
                const cartQty = cart
                  .filter((c) => c.menuItemId === item.id)
                  .reduce((sum, c) => sum + c.quantity, 0);
                
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMenuItemTap(item)}
                    disabled={isSoldOut}
                    className="text-left"
                  >
                    <Card className={`h-full transition-all ${
                      isSoldOut ? "opacity-60" : "hover:shadow-md active:scale-[0.98]"
                    } ${cartQty > 0 ? "ring-2 ring-primary" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium line-clamp-2 text-base">
                              {item.name}
                            </div>
                            <div className="text-lg font-bold text-primary mt-1">
                              ¥{Number(item.price).toLocaleString()}
                            </div>
                          </div>
                          {cartQty > 0 && (
                            <Badge className="shrink-0 text-base px-3">
                              {cartQty}
                            </Badge>
                          )}
                        </div>
                        {isSoldOut && (
                          <Badge variant="secondary" className="mt-2">
                            売切れ
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </main>

      {/* Bottom Bar */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="p-4 space-y-3">
            <SheetTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">カート</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">
                    {totalItems}点 · ¥{totalAmount.toLocaleString()}
                  </span>
                </div>
              </button>
            </SheetTrigger>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-14"
                onClick={clearCart}
                disabled={cart.length === 0 || addItemsMutation.isPending}
              >
                クリア
              </Button>
              <Button
                className="flex-1 h-14 text-lg"
                onClick={handleSubmit}
                disabled={!canSubmit || addItemsMutation.isPending}
              >
                {addItemsMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    送信中...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    キッチンへ送信
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Cart Sheet */}
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>カート</SheetTitle>
            <SheetDescription>注文内容を確認・編集</SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1 h-[calc(100%-8rem)] mt-4">
            <div className="space-y-3 pr-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  カートは空です
                </div>
              ) : (
                cart.map((item, index) => (
                  <Card key={`${item.menuItemId}-${index}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-primary font-bold">
                            ¥{item.price.toLocaleString()} × {item.quantity}
                          </div>
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.modifiers.map((mod) => (
                                <Badge key={mod.id} variant="secondary" className="text-xs">
                                  {mod.name} ×{mod.quantity}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {item.notes && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {item.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            onClick={() => {
                              if (item.quantity === 1) {
                                removeFromCart(item.menuItemId, item.modifiers);
                              } else {
                                updateQuantity(item.menuItemId, -1, item.modifiers);
                              }
                            }}
                          >
                            {item.quantity === 1 ? (
                              <Trash2 className="h-4 w-4 text-red-500" />
                            ) : (
                              <Minus className="h-4 w-4" />
                            )}
                          </Button>
                          <span className="w-8 text-center font-bold text-lg">
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            onClick={() => updateQuantity(item.menuItemId, 1, item.modifiers)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              {orderNotes && (
                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">備考:</span> {orderNotes}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>

          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground">合計</span>
              <span className="text-2xl font-bold">
                {totalItems}点 · ¥{totalAmount.toLocaleString()}
              </span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
