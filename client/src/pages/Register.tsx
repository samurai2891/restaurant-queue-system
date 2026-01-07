import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMenuCart, type MenuItem } from "@/hooks/useMenuCart";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

type LeftTab = "tickets" | "queue";
type CreateTicketKind = "DINE_IN" | "COUNTER_SALE" | "MEMO_ONLY";

type TicketPosStatus = "OPEN" | "MEMO_ONLY" | "ITEMIZED" | "PAYMENT_LOCKED" | "PAID" | "VOID";

const statusBadgeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  OPEN: "secondary",
  ITEMIZED: "secondary",
  MEMO_ONLY: "outline",
  PAYMENT_LOCKED: "default",
  PAID: "secondary",
  VOID: "destructive",
};

export default function Register() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = Number.parseInt(storeId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();

  const [leftTab, setLeftTab] = useState<LeftTab>("tickets");
  const [ticketSearch, setTicketSearch] = useState("");
  const [queueSearch, setQueueSearch] = useState("");
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);

  const [productSearch, setProductSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<CreateTicketKind>("DINE_IN");
  const [createPartySize, setCreatePartySize] = useState("2");
  const [createTableLabel, setCreateTableLabel] = useState("");
  const [createGuestName, setCreateGuestName] = useState("");
  const [createMemoText, setCreateMemoText] = useState("");

  const [metaOpen, setMetaOpen] = useState(false);
  const [metaPartySize, setMetaPartySize] = useState("");
  const [metaTableLabel, setMetaTableLabel] = useState("");
  const [metaGuestName, setMetaGuestName] = useState("");

  const [memoDraft, setMemoDraft] = useState("");

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [manualMethod, setManualMethod] = useState("card");
  const [completed, setCompleted] = useState<null | { totalAmount: number; changeAmount?: number }>(null);

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

  const { data: tickets, isLoading: ticketsLoading, refetch: refetchTickets } = trpc.ticket.list.useQuery(
    {
      storeId: storeIdNum,
      search: ticketSearch.trim() || undefined,
    },
    { enabled: isAuthenticated && storeIdNum > 0, refetchInterval: 5000 }
  );

  const { data: parties, isLoading: partiesLoading, refetch: refetchParties } = trpc.party.list.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0, refetchInterval: 5000 }
  );

  const { data: ticketData, isLoading: ticketLoading, refetch: refetchTicket } = trpc.ticket.get.useQuery(
    { storeId: storeIdNum, ticketId: activeTicketId ?? 0 },
    { enabled: isAuthenticated && storeIdNum > 0 && Boolean(activeTicketId), refetchInterval: 5000 }
  );

  const menuItems = items as MenuItem[] | undefined;
  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    totalAmount: draftTotalAmount,
    totalItems: draftTotalItems,
    setCart,
  } = useMenuCart(menuItems);

  const ticket = ticketData?.ticket;
  const unpaidOrders = ticketData?.orders ?? [];
  const persistedTotalAmount = ticketData?.totals.totalAmount ?? 0;
  const persistedTotalItems = ticketData?.totals.totalItems ?? 0;
  const combinedTotal = persistedTotalAmount + draftTotalAmount;
  const combinedItems = persistedTotalItems + draftTotalItems;

  const posStatus = (ticket?.posStatus ?? "OPEN") as TicketPosStatus;
  const isLocked = posStatus === "PAYMENT_LOCKED";
  const isMemoOnly = posStatus === "MEMO_ONLY";
  const canEditTicket = Boolean(ticket) && !isLocked;
  const canAddLineItems = Boolean(ticket) && !isLocked && !isMemoOnly;

  const createTicketMutation = trpc.ticket.create.useMutation({
    onSuccess: (created) => {
      toast.success(`伝票 #${created.ticketNumber} を作成しました`);
      setActiveTicketId(created.id);
      setLeftTab("tickets");
      setCreateOpen(false);
      setCart([]);
      setCompleted(null);
      setCashReceived("");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMetaMutation = trpc.ticket.updateMeta.useMutation({
    onSuccess: () => {
      toast.success("伝票情報を更新しました");
      refetchTicket();
      refetchTickets();
      setMetaOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const markItemizedMutation = trpc.ticket.markItemized.useMutation({
    onSuccess: () => {
      toast.success("明細入力に切り替えました");
      refetchTicket();
      refetchTickets();
    },
    onError: (e) => toast.error(e.message),
  });

  const addItemsMutation = trpc.ticket.addItemsToTicket.useMutation({
    onSuccess: (res) => {
      toast.success(`明細を追加しました（注文 #${res.orderNumber}）`);
      setCart([]);
      refetchTicket();
      refetchTickets();
      refetchParties();
    },
    onError: (e) => toast.error(e.message),
  });

  const lockMutation = trpc.ticket.lockForPayment.useMutation({
    onSuccess: () => {
      toast.success("会計を開始しました（ロック）");
      refetchTicket();
      refetchTickets();
    },
    onError: (e) => toast.error(e.message),
  });

  const unlockMutation = trpc.ticket.unlock.useMutation({
    onSuccess: () => {
      toast.success("ロックを解除しました");
      refetchTicket();
      refetchTickets();
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmCashMutation = trpc.payment.confirmCash.useMutation({
    onSuccess: (res) => {
      toast.success("会計を確定しました");
      setCompleted({ totalAmount: res.totalAmount, changeAmount: res.changeAmount });
      refetchTicket();
      refetchTickets();
      refetchParties();
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmManualMutation = trpc.payment.confirmManual.useMutation({
    onSuccess: (res) => {
      toast.success("会計を確定しました");
      setCompleted({ totalAmount: res.totalAmount });
      refetchTicket();
      refetchTickets();
      refetchParties();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    setCart([]);
    setCompleted(null);
      setCashReceived("");
    setManualMethod("card");
    setPaymentOpen(false);
  }, [activeTicketId, setCart]);

  useEffect(() => {
    setMemoDraft(ticket?.memoText ?? "");
  }, [ticket?.memoText]);

  useEffect(() => {
    if (createOpen) return;
    setCreatePartySize("2");
    setCreateTableLabel("");
    setCreateGuestName("");
    setCreateMemoText("");
  }, [createOpen]);

  const filteredItems = useMemo(() => {
    const list = menuItems ?? [];
    let results = list;
    if (activeCategory !== "all") {
      const catId = Number.parseInt(activeCategory, 10);
      results = results.filter((i) => i.categoryId === catId);
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      results = results.filter((i) => i.name.toLowerCase().includes(q));
    }
    return results;
  }, [activeCategory, menuItems, productSearch]);

  const visibleQueueParties = useMemo(() => {
    const list = parties ?? [];
    const active = list.filter((p) => ["waiting", "notified", "arrived"].includes(p.status));
    if (!queueSearch.trim()) return active;
    const q = queueSearch.trim().toLowerCase();
    const numeric = Number.parseInt(q, 10);
    return active.filter((p) => {
      const byNumber = Number.isFinite(numeric) && p.ticketNumber === numeric;
      const byName = (p.guestName ?? "").toLowerCase().includes(q);
      const byTable = (p.tableLabel ?? "").toLowerCase().includes(q);
      return byNumber || byName || byTable;
    });
  }, [parties, queueSearch]);

  const handleCreateOpen = (kind: CreateTicketKind) => {
    setCreateKind(kind);
    if (kind === "COUNTER_SALE") {
      createTicketMutation.mutate({ storeId: storeIdNum, kind });
      return;
    }
    setCreateOpen(true);
  };

  const handleCreateSubmit = async () => {
    const partySizeNumber = Number.parseInt(createPartySize || "1", 10);
    if (createKind === "DINE_IN" && (!Number.isFinite(partySizeNumber) || partySizeNumber < 1)) {
      toast.error("人数を入力してください");
      return;
    }

    try {
      await createTicketMutation.mutateAsync({
        storeId: storeIdNum,
        kind: createKind,
        partySize: createKind === "DINE_IN" ? partySizeNumber : undefined,
        tableLabel: createTableLabel.trim() ? createTableLabel.trim() : undefined,
        guestName: createGuestName.trim() ? createGuestName.trim() : undefined,
        memoText: createKind === "MEMO_ONLY" && createMemoText.trim() ? createMemoText.trim() : undefined,
      });
    } catch {
      // onError で toast 済み
    }
  };

  const handleSaveDraft = async () => {
    if (!ticket) {
      toast.error("伝票を選択してください");
      return false;
    }
    if (cart.length === 0) {
      toast.error("追加明細がありません");
      return false;
    }
    try {
      await addItemsMutation.mutateAsync({
        storeId: storeIdNum,
        ticketId: ticket.id,
        items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity })),
        entrySource: "staff_register",
        routeToKitchen: true,
      });
      return true;
    } catch {
      // onError で toast 済み
      return false;
    }
  };

  const handleStartPayment = async () => {
    if (!ticket) {
      toast.error("伝票を選択してください");
      return;
    }

    if (isMemoOnly) {
      toast.error("メモ伝票は明細入力後に会計できます");
      return;
    }

    if (cart.length > 0) {
      const ok = await handleSaveDraft();
      if (!ok) return;
    }

    if (ticket.posStatus !== "PAYMENT_LOCKED") {
      try {
        await lockMutation.mutateAsync({ storeId: storeIdNum, ticketId: ticket.id });
      } catch {
        // onError で toast 済み
        return;
      }
    }
    await refetchTicket();

    setCompleted(null);
    setCashReceived("");
    setManualMethod("card");
    setPaymentOpen(true);
  };

  const handleOpenMeta = () => {
    if (!ticket) return;
    setMetaPartySize(String(ticket.partySize ?? ""));
    setMetaTableLabel(ticket.tableLabel ?? "");
    setMetaGuestName(ticket.guestName ?? "");
    setMetaOpen(true);
  };

  const handleSubmitMeta = async () => {
    if (!ticket) return;
    const partySizeRaw = metaPartySize.trim();
    if (!partySizeRaw) {
      toast.error("人数を入力してください");
      return;
    }
    const partySizeNumber = Number.parseInt(partySizeRaw, 10);
    if (!Number.isFinite(partySizeNumber) || partySizeNumber < 1) {
      toast.error("人数を入力してください");
      return;
    }

    try {
      await updateMetaMutation.mutateAsync({
        storeId: storeIdNum,
        ticketId: ticket.id,
        partySize: partySizeNumber,
        tableLabel: metaTableLabel.trim() ? metaTableLabel.trim() : null,
        guestName: metaGuestName.trim() ? metaGuestName.trim() : null,
      });
    } catch {
      // onError で toast 済み
    }
  };

  const cashReceivedNumber = cashReceived ? Number(cashReceived) : 0;
  const changeAmount = cashReceivedNumber - persistedTotalAmount;
  const needsLock = Boolean(ticket) && ticket?.posStatus !== "PAYMENT_LOCKED";
  const canConfirmCash = cashReceivedNumber >= persistedTotalAmount && persistedTotalAmount > 0 && !needsLock;
  const isSubmittingPayment = lockMutation.isPending || confirmCashMutation.isPending || confirmManualMutation.isPending;

  if (authLoading || storeLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
  return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
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
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>店舗が見つかりません</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar (Airレジ風) */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
        <Link href={`/queue/${storeIdNum}`}>
              <Button variant="ghost" size="icon" aria-label="戻る">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
            <div className="leading-tight">
              <div className="font-semibold">レジ</div>
              <div className="text-xs text-muted-foreground">{store.name}</div>
        </div>
            {ticket && (
              <Badge variant="outline" className="ml-2">
                伝票 #{ticket.ticketNumber}
              </Badge>
            )}
      </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchTickets();
                refetchParties();
                refetchTicket();
              }}
              disabled={ticketsLoading || partiesLoading || ticketLoading}
            >
              再読込
            </Button>
                </div>
          </div>
      </header>

      {/* Body: 3カラム（左:導線/中央:商品/右:明細+会計） */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_460px] min-h-[calc(100vh-3.5rem)]">
        {/* Left */}
        <div className="border-r bg-muted/10">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handleCreateOpen("DINE_IN")}
                disabled={createTicketMutation.isPending || storeIdNum <= 0}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                店内伝票
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCreateOpen("COUNTER_SALE")}
                disabled={createTicketMutation.isPending || storeIdNum <= 0}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                店頭（Quick）
              </Button>
              <Button
                variant="outline"
                onClick={() => handleCreateOpen("MEMO_ONLY")}
                disabled={createTicketMutation.isPending || storeIdNum <= 0}
                className="gap-2 col-span-2"
              >
                <Plus className="w-4 h-4" />
                メモ伝票
              </Button>
                  </div>

            <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as LeftTab)}>
              <TabsList className="w-full">
                <TabsTrigger value="tickets" className="flex-1">
                  伝票
                </TabsTrigger>
                <TabsTrigger value="queue" className="flex-1">
                  受付
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {leftTab === "tickets" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-sm">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    placeholder="伝票番号 / テーブル / 顧客名で検索"
                    className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  />
                    </div>

                <ScrollArea className="h-[70vh] pr-3">
                  {ticketsLoading ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : !tickets || tickets.length === 0 ? (
                    <Card>
                      <CardContent className="py-10 text-center text-muted-foreground">
                        伝票がありません
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3">
                      {tickets.map((t) => {
                        const isActive = activeTicketId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className="text-left"
                            onClick={() => setActiveTicketId(t.id)}
                          >
                            <Card className={`hover:shadow-sm transition-shadow ${isActive ? "ring-2 ring-primary" : ""}`}>
                              <CardContent className="p-4 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant={statusBadgeVariant[t.posStatus] ?? "secondary"}>
                                    {t.posStatus}
                                  </Badge>
                                  <div className="font-semibold">
                                    伝票 #{t.ticketNumber}
                                    {t.tableLabel ? ` · ${t.tableLabel}` : ""}
                          </div>
                        </div>
                                <div className="flex items-center justify-between text-sm text-muted-foreground">
                                  <div className="line-clamp-1">
                                    {t.guestName ?? "お客様"}（{t.partySize}名）
                      </div>
                                  <div className="font-semibold text-foreground">
                                    ¥{Number(t.unpaidTotalAmount ?? 0).toLocaleString()}
                  </div>
                  </div>
                </CardContent>
              </Card>
                          </button>
                        );
                      })}
            </div>
          )}
                </ScrollArea>
                </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-sm">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="受付番号 / テーブル / 名前で検索"
                    className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  />
              </div>

                <ScrollArea className="h-[70vh] pr-3">
                  {partiesLoading ? (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : visibleQueueParties.length === 0 ? (
                  <Card>
                      <CardContent className="py-10 text-center text-muted-foreground">
                        対象の受付がありません
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3">
                      {visibleQueueParties.map((p) => {
                        const isActive = activeTicketId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className="text-left"
                            onClick={() => setActiveTicketId(p.id)}
                          >
                            <Card className={`hover:shadow-sm transition-shadow ${isActive ? "ring-2 ring-primary" : ""}`}>
                              <CardContent className="p-4 flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-semibold">
                                    受付 #{p.ticketNumber}
                      </div>
                                  <Badge variant="outline">{p.status}</Badge>
                      </div>
                                <div className="text-sm text-muted-foreground">
                                  {p.guestName ?? "お客様"}（{p.partySize}名）
                      </div>
                    </CardContent>
                  </Card>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </div>
        </div>

        {/* Center */}
        <div className="p-4 space-y-4">
          {!ticket ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                左のリストから伝票を選択するか、新規伝票を作成してください。
              </CardContent>
            </Card>
          ) : (
            <>
              {isLocked && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">会計中です</CardTitle>
                    <CardDescription>他端末からの編集/追加を制限しています。</CardDescription>
                  </CardHeader>
                </Card>
              )}
              {isMemoOnly && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">メモ伝票</CardTitle>
                    <CardDescription>明細入力に切り替えるまで商品追加/会計はできません。</CardDescription>
                  </CardHeader>
                </Card>
              )}

              <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-2 shadow-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="商品名で検索..."
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                  disabled={!canAddLineItems || isSubmittingPayment}
                />
              </div>

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
                      disabled={isSoldOut || !canAddLineItems || isSubmittingPayment}
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
            </>
          )}
        </div>

        {/* Right */}
        <div className="border-l bg-muted/10">
          <div className="p-4 space-y-4">
            {!ticket ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  伝票を選択すると、明細と会計が表示されます。
                </CardContent>
              </Card>
                    ) : (
                      <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        明細 <Badge variant="outline">{combinedItems}点</Badge>
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusBadgeVariant[posStatus] ?? "secondary"}>{posStatus}</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenMeta}
                          disabled={!canEditTicket || updateMetaMutation.isPending}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          伝票編集
                        </Button>
                        {posStatus === "PAYMENT_LOCKED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unlockMutation.mutate({ storeId: storeIdNum, ticketId: ticket.id })}
                            disabled={unlockMutation.isPending}
                          >
                            ロック解除
                          </Button>
                        )}
                      </div>
                    </CardTitle>
                    <CardDescription>
                      伝票 #{ticket.ticketNumber}
                      {ticket.tableLabel ? ` · ${ticket.tableLabel}` : ""}
                      {` · ${ticket.partySize}名`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isMemoOnly && (
                      <div className="space-y-3 rounded-lg border bg-amber-50 p-3">
                        <div className="text-sm font-medium">メモ</div>
                        <Textarea
                          value={memoDraft}
                          onChange={(e) => setMemoDraft(e.target.value)}
                          placeholder="口頭メモを入力（例: 焼き加減、アレルギーなど）"
                          rows={4}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            variant="outline"
                            onClick={() =>
                              updateMetaMutation.mutate({
                                storeId: storeIdNum,
                                ticketId: ticket.id,
                                memoText: memoDraft,
                              })
                            }
                            disabled={updateMetaMutation.isPending || isLocked}
                          >
                            メモを保存
                          </Button>
                          <Button
                            onClick={() => markItemizedMutation.mutate({ storeId: storeIdNum, ticketId: ticket.id })}
                            disabled={markItemizedMutation.isPending || isLocked}
                          >
                            明細入力に切り替える
                  </Button>
              </div>
            </div>
          )}

                    <ScrollArea className="h-[45vh] pr-3">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="text-xs text-muted-foreground">未精算（既存）</div>
                          {unpaidOrders.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-2">未精算明細はありません</div>
                          ) : (
                            unpaidOrders.flatMap((order) =>
                              (order.items ?? []).map((it) => (
                                <div key={`p-${order.id}-${it.id}`} className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium line-clamp-1">
                                      {it.menuItem?.name ?? `商品#${it.menuItemId}`}
                </div>
                                    <div className="text-xs text-muted-foreground">
                                      x{it.quantity} · ¥{Number(it.subtotal ?? 0).toLocaleString()}
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
                              <div
                                key={`d-${c.menuItemId}`}
                                className="flex items-center justify-between gap-3 rounded-lg border bg-background p-2"
                              >
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
                                    disabled={!canAddLineItems}
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
                                    disabled={!canAddLineItems}
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

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="h-12 flex-1"
                        onClick={handleSaveDraft}
                        disabled={!canAddLineItems || cart.length === 0 || addItemsMutation.isPending}
                      >
                        一時保存
                      </Button>
                      <Button
                        className="h-12 flex-1"
                        onClick={handleStartPayment}
                        disabled={Boolean(ticket) && (isMemoOnly || lockMutation.isPending || isSubmittingPayment)}
                      >
                        <Wallet className="w-4 h-4 mr-2" />
                        支払い
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
                      </div>
                  </div>
                </div>

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createKind === "DINE_IN" ? "店内伝票を作成" : "メモ伝票を作成"}
            </DialogTitle>
            <DialogDescription>必要項目を入力して作成します。</DialogDescription>
          </DialogHeader>
                <div className="space-y-4">
            {createKind === "DINE_IN" && (
              <div className="space-y-2">
                <Label htmlFor="create-party-size">人数</Label>
                <Input
                  id="create-party-size"
                  type="number"
                  min={1}
                  value={createPartySize}
                  onChange={(e) => setCreatePartySize(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="create-table-label">テーブル名（任意）</Label>
              <Input
                id="create-table-label"
                value={createTableLabel}
                onChange={(e) => setCreateTableLabel(e.target.value)}
                placeholder="例: T-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-guest-name">顧客名（任意）</Label>
              <Input
                id="create-guest-name"
                value={createGuestName}
                onChange={(e) => setCreateGuestName(e.target.value)}
                placeholder="例: 山田様"
              />
            </div>
            {createKind === "MEMO_ONLY" && (
              <div className="space-y-2">
                <Label htmlFor="create-memo-text">メモ（任意）</Label>
                <Textarea
                  id="create-memo-text"
                  value={createMemoText}
                  onChange={(e) => setCreateMemoText(e.target.value)}
                  placeholder="口頭メモなど"
                  rows={4}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createTicketMutation.isPending}>
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meta Dialog */}
      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>伝票編集</DialogTitle>
            <DialogDescription>テーブル名・人数などを更新します。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meta-table-label">テーブル名</Label>
              <Input
                id="meta-table-label"
                value={metaTableLabel}
                onChange={(e) => setMetaTableLabel(e.target.value)}
                placeholder="例: T-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-party-size">人数</Label>
              <Input
                id="meta-party-size"
                type="number"
                min={1}
                value={metaPartySize}
                onChange={(e) => setMetaPartySize(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-guest-name">顧客名</Label>
              <Input
                id="meta-guest-name"
                value={metaGuestName}
                onChange={(e) => setMetaGuestName(e.target.value)}
                placeholder="例: 山田様"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSubmitMeta} disabled={updateMetaMutation.isPending || !canEditTicket}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog
        open={paymentOpen}
        onOpenChange={(open) => {
          setPaymentOpen(open);
          if (!open) {
            setCompleted(null);
            setCashReceived("");
            setManualMethod("card");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>支払い</DialogTitle>
            <DialogDescription>
              伝票 #{ticket?.ticketNumber ?? "-"} の会計を確定します。
            </DialogDescription>
          </DialogHeader>

          {completed ? (
            <div className="space-y-6">
                  <Card>
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2 text-green-700">
                    <CheckCircle2 className="w-6 h-6" />
                    お会計を完了しました
                      </CardTitle>
                  <CardDescription>会計結果</CardDescription>
                    </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="text-sm text-muted-foreground">合計</div>
                    <div className="text-4xl font-bold">¥{completed.totalAmount.toLocaleString()}</div>
                        </div>
                  {completed.changeAmount !== undefined && (
                    <div className="text-center space-y-2">
                      <div className="text-sm text-muted-foreground">おつり</div>
                      <div className="text-5xl font-bold text-primary">¥{completed.changeAmount.toLocaleString()}</div>
                        </div>
                      )}
                </CardContent>
              </Card>
              <DialogFooter>
                      <Button
                  onClick={() => setPaymentOpen(false)}
                  className="w-full sm:w-auto"
                >
                  閉じる
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {needsLock && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">会計開始（ロック）</CardTitle>
                    <CardDescription>会計中は他端末からの編集/追加を制限します。</CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => ticket && lockMutation.mutate({ storeId: storeIdNum, ticketId: ticket.id })}
                      disabled={isSubmittingPayment}
                    >
                      会計を開始する
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPaymentOpen(false)}
                      disabled={isSubmittingPayment}
                    >
                      閉じる
                      </Button>
                    </CardContent>
                  </Card>
              )}

              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                      <Wallet className="w-5 h-5" />
                      会計対象
                      </CardTitle>
                    <CardDescription>未精算の明細合計です</CardDescription>
                    </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">合計（税込）</span>
                      <span className="text-xl font-bold text-primary">¥{persistedTotalAmount.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="text-xs text-muted-foreground">
                      ロック中のみ確定できます。
                      </div>
                    </CardContent>
                  </Card>

              <Card>
                <CardHeader>
                    <CardTitle>現金</CardTitle>
                    <CardDescription>受取金額を入力して確定します</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">受取金額</div>
                        <Input
                          type="number"
                          min={0}
                          value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder="例: 10000"
                        disabled={isSubmittingPayment || needsLock}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">おつり</span>
                        <span className={`font-semibold ${changeAmount < 0 ? "text-destructive" : "text-foreground"}`}>
                        {cashReceived ? (
                          changeAmount >= 0
                            ? `¥${changeAmount.toLocaleString()}`
                            : `不足 ¥${Math.abs(changeAmount).toLocaleString()}`
                        ) : "-"}
                        </span>
                      </div>
                  <Button
                    className="w-full"
                      onClick={() =>
                        ticket &&
                        confirmCashMutation.mutate({
                          storeId: storeIdNum,
                          ticketId: ticket.id,
                          cashReceived: cashReceivedNumber,
                        })
                      }
                      disabled={!canConfirmCash || isSubmittingPayment}
                    >
                      現金で確定
                  </Button>
                </CardContent>
              </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>手動確定</CardTitle>
                  <CardDescription>外部POS/カード等で支払い済みの場合</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={manualMethod} onValueChange={setManualMethod} className="space-y-2">
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="card" id="register-manual-card" />
                      <span className="text-sm font-medium">カード</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="qr" id="register-manual-qr" />
                      <span className="text-sm font-medium">QR決済</span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="external" id="register-manual-external" />
                      <span className="text-sm font-medium">外部POS（手動確定）</span>
                    </label>
                  </RadioGroup>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() =>
                      ticket &&
                      confirmManualMutation.mutate({
                        storeId: storeIdNum,
                        ticketId: ticket.id,
                        paymentMethod: manualMethod,
                      })
                    }
                    disabled={isSubmittingPayment || needsLock || persistedTotalAmount <= 0}
                  >
                    手動で確定
                </Button>
        </CardContent>
      </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
