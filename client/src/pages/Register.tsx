
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMenuCart, type MenuItem } from "@/hooks/useMenuCart";
import { filterMenuItems } from "@/lib/menuFilter";
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
type MobileTab = "left" | "menu";
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
  const [mobileTab, setMobileTab] = useState<MobileTab>("left");
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
      toast.success(`莨晉･ｨ #${created.ticketNumber} 繧剃ｽ懈・縺励∪縺励◆`);
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
      toast.success("莨晉･ｨ諠・ｱ繧呈峩譁ｰ縺励∪縺励◆");
      refetchTicket();
      refetchTickets();
      setMetaOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const markItemizedMutation = trpc.ticket.markItemized.useMutation({
    onSuccess: () => {
      toast.success("譏守ｴｰ蜈･蜉帙↓蛻・ｊ譖ｿ縺医∪縺励◆");
      refetchTicket();
      refetchTickets();
    },
    onError: (e) => toast.error(e.message),
  });

  const addItemsMutation = trpc.ticket.addItemsToTicket.useMutation({
    onSuccess: (res) => {
      toast.success(`譏守ｴｰ繧定ｿｽ蜉縺励∪縺励◆・域ｳｨ譁・#${res.orderNumber}・荏);
      setCart([]);
      refetchTicket();
      refetchTickets();
      refetchParties();
    },
    onError: (e) => toast.error(e.message),
  });

  const lockMutation = trpc.ticket.lockForPayment.useMutation({
    onSuccess: () => {
      toast.success("莨夊ｨ医ｒ髢句ｧ九＠縺ｾ縺励◆・医Ο繝・け・・);
      refetchTicket();
      refetchTickets();
    },
    onError: (e) => toast.error(e.message),
  });

  const unlockMutation = trpc.ticket.unlock.useMutation({
    onSuccess: () => {
      toast.success("繝ｭ繝・け繧定ｧ｣髯､縺励∪縺励◆");
      refetchTicket();
      refetchTickets();
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmCashMutation = trpc.payment.confirmCash.useMutation({
    onSuccess: (res) => {
      toast.success("莨夊ｨ医ｒ遒ｺ螳壹＠縺ｾ縺励◆");
      setCompleted({ totalAmount: res.totalAmount, changeAmount: res.changeAmount });
      refetchTicket();
      refetchTickets();
      refetchParties();
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmManualMutation = trpc.payment.confirmManual.useMutation({
    onSuccess: (res) => {
      toast.success("莨夊ｨ医ｒ遒ｺ螳壹＠縺ｾ縺励◆");
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
  const filteredItems = useMemo(
    () => filterMenuItems(menuItems, { categoryId: activeCategory, searchQuery: productSearch }),
    [activeCategory, menuItems, productSearch]
  );

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
      toast.error("莠ｺ謨ｰ繧貞・蜉帙＠縺ｦ縺上□縺輔＞");
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
      // onError 縺ｧ toast 貂医∩
    }
  };

  const handleSaveDraft = async () => {
    if (!ticket) {
      toast.error("莨晉･ｨ繧帝∈謚槭＠縺ｦ縺上□縺輔＞");
      return false;
    }
    if (cart.length === 0) {
      toast.error("霑ｽ蜉譏守ｴｰ縺後≠繧翫∪縺帙ｓ");
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
      // onError 縺ｧ toast 貂医∩
      return false;
    }
  };

  const handleStartPayment = async () => {
    if (!ticket) {
      toast.error("莨晉･ｨ繧帝∈謚槭＠縺ｦ縺上□縺輔＞");
      return;
    }

    if (isMemoOnly) {
      toast.error("繝｡繝｢莨晉･ｨ縺ｯ譏守ｴｰ蜈･蜉帛ｾ後↓莨夊ｨ医〒縺阪∪縺・);
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
        // onError 縺ｧ toast 貂医∩
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
      toast.error("莠ｺ謨ｰ繧貞・蜉帙＠縺ｦ縺上□縺輔＞");
      return;
    }
    const partySizeNumber = Number.parseInt(partySizeRaw, 10);
    if (!Number.isFinite(partySizeNumber) || partySizeNumber < 1) {
      toast.error("莠ｺ謨ｰ繧貞・蜉帙＠縺ｦ縺上□縺輔＞");
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
      // onError 縺ｧ toast 貂医∩
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
            <CardTitle>繝ｭ繧ｰ繧､繝ｳ縺悟ｿ・ｦ√〒縺・/CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/staff">
              <Button className="w-full">繧ｹ繧ｿ繝・ヵ蜈･蜿｣縺ｸ</Button>
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
            <CardTitle>蠎苓・縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex -m-4 h-[calc(100svh-3.5rem)] min-h-0 flex-col bg-background overflow-hidden md:m-0 md:h-[100svh]">
      {/* Top Bar (Air繝ｬ繧ｸ鬚ｨ) */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
        <Link href={`/queue/${storeIdNum}`}>
              <Button variant="ghost" size="icon" aria-label="謌ｻ繧・>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
            <div className="leading-tight">
              <div className="font-semibold">繝ｬ繧ｸ</div>
              <div className="text-xs text-muted-foreground">{store.name}</div>
        </div>
            {ticket && (
              <Badge variant="outline" className="ml-2">
                莨晉･ｨ #{ticket.ticketNumber}
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
              蜀崎ｪｭ霎ｼ
            </Button>
                </div>
          </div>
      </header>

      <Sheet>
        {/* Mobile Tab Switcher */}
        <div className="lg:hidden border-b bg-muted/10 px-4 py-2">
          <div className="flex gap-2">
            <Button
              variant={mobileTab === "left" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setMobileTab("left")}
            >
              莨晉･ｨ/蜿嶺ｻ・
            </Button>
            <Button
              variant={mobileTab === "menu" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setMobileTab("menu")}
            >
              繝｡繝九Η繝ｼ
            </Button>
          </div>
        </div>

        {/* Body: 2繧ｫ繝ｩ繝・亥ｷｦ:蟆守ｷ・荳ｭ螟ｮ:蝠・刀・・*/}
        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[340px_1fr] overflow-hidden">
          {/* Left */}
          <div className={`border-r bg-muted/10 flex min-h-0 flex-col ${mobileTab !== "left" ? "hidden lg:flex" : ""}`}>
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => handleCreateOpen("DINE_IN")}
                  disabled={createTicketMutation.isPending || storeIdNum <= 0}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  蠎怜・莨晉･ｨ
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCreateOpen("COUNTER_SALE")}
                  disabled={createTicketMutation.isPending || storeIdNum <= 0}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  蠎鈴ｭ・・uick・・
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCreateOpen("MEMO_ONLY")}
                  disabled={createTicketMutation.isPending || storeIdNum <= 0}
                  className="gap-2 col-span-2"
                >
                  <Plus className="w-4 h-4" />
                  繝｡繝｢莨晉･ｨ
                </Button>
              </div>

              <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as LeftTab)}>
                <TabsList className="w-full">
                  <TabsTrigger value="tickets" className="flex-1">
                    莨晉･ｨ
                  </TabsTrigger>
                  <TabsTrigger value="queue" className="flex-1">
                    蜿嶺ｻ・
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {leftTab === "tickets" ? (
                <div className="flex flex-1 min-h-0 flex-col gap-3">
                  <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-sm">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={ticketSearch}
                      onChange={(e) => setTicketSearch(e.target.value)}
                      placeholder="莨晉･ｨ逡ｪ蜿ｷ / 繝・・繝悶Ν / 鬘ｧ螳｢蜷阪〒讀懃ｴ｢"
                      className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  <ScrollArea className="flex-1 min-h-0 pr-3">
                    {ticketsLoading ? (
                      <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    ) : !tickets || tickets.length === 0 ? (
                      <Card>
                        <CardContent className="py-10 text-center text-muted-foreground">
                          莨晉･ｨ縺後≠繧翫∪縺帙ｓ
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
                              onClick={() => {
                                setActiveTicketId(t.id);
                                setMobileTab("menu");
                              }}
                            >
                              <Card className={`hover:shadow-sm transition-shadow ${isActive ? "ring-2 ring-primary" : ""}`}>
                                <CardContent className="p-4 flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={statusBadgeVariant[t.posStatus] ?? "secondary"}>
                                      {t.posStatus}
                                    </Badge>
                                    <div className="font-semibold">
                                      莨晉･ｨ #{t.ticketNumber}
                                      {t.tableLabel ? ` ﾂｷ ${t.tableLabel}` : ""}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                                    <div className="line-clamp-1">
                                      {t.guestName ?? "縺雁ｮ｢讒・}・・t.partySize}蜷搾ｼ・
                                    </div>
                                    <div className="font-semibold text-foreground">
                                      ﾂ･{Number(t.unpaidTotalAmount ?? 0).toLocaleString()}
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
                <div className="flex flex-1 min-h-0 flex-col gap-3">
                  <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-sm">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={queueSearch}
                      onChange={(e) => setQueueSearch(e.target.value)}
                      placeholder="蜿嶺ｻ倡分蜿ｷ / 繝・・繝悶Ν / 蜷榊燕縺ｧ讀懃ｴ｢"
                      className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  <ScrollArea className="flex-1 min-h-0 pr-3">
                    {partiesLoading ? (
                      <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    ) : visibleQueueParties.length === 0 ? (
                      <Card>
                        <CardContent className="py-10 text-center text-muted-foreground">
                          蟇ｾ雎｡縺ｮ蜿嶺ｻ倥′縺ゅｊ縺ｾ縺帙ｓ
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
                              onClick={() => {
                                setActiveTicketId(p.id);
                                setMobileTab("menu");
                              }}
                            >
                              <Card className={`hover:shadow-sm transition-shadow ${isActive ? "ring-2 ring-primary" : ""}`}>
                                <CardContent className="p-4 flex flex-col gap-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="font-semibold">
                                      蜿嶺ｻ・#{p.ticketNumber}
                                    </div>
                                    <Badge variant="outline">{p.status}</Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {p.guestName ?? "縺雁ｮ｢讒・}・・p.partySize}蜷搾ｼ・
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
          <div className={`flex min-h-0 flex-col ${mobileTab !== "menu" ? "hidden lg:flex" : ""}`}>
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
              {!ticket ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    蟾ｦ縺ｮ繝ｪ繧ｹ繝医°繧我ｼ晉･ｨ繧帝∈謚槭☆繧九°縲∵眠隕丈ｼ晉･ｨ繧剃ｽ懈・縺励※縺上□縺輔＞縲・
                  </CardContent>
                </Card>
              ) : (
                <>
                  {isLocked && (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">莨夊ｨ井ｸｭ縺ｧ縺・/CardTitle>
                        <CardDescription>莉也ｫｯ譛ｫ縺九ｉ縺ｮ邱ｨ髮・霑ｽ蜉繧貞宛髯舌＠縺ｦ縺・∪縺吶・/CardDescription>
                      </CardHeader>
                    </Card>
                  )}
                  {isMemoOnly && (
                    <Card className="border-amber-200 bg-amber-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">繝｡繝｢莨晉･ｨ</CardTitle>
                        <CardDescription>譏守ｴｰ蜈･蜉帙↓蛻・ｊ譖ｿ縺医ｋ縺ｾ縺ｧ蝠・刀霑ｽ蜉/莨夊ｨ医・縺ｧ縺阪∪縺帙ｓ縲・/CardDescription>
                      </CardHeader>
                    </Card>
                  )}

                  <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-2 shadow-sm">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      placeholder="蝠・刀蜷阪〒讀懃ｴ｢..."
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
                          縺吶∋縺ｦ
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

                  <ScrollArea className="flex-1 min-h-0 pr-2">
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
                              ﾂ･{Number(item.price).toLocaleString()}
                            </div>
                            <div className="mt-2">
                              {isSoldOut ? (
                                <Badge variant="secondary">螢ｲ蛻・ｌ</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">蝨ｨ蠎ｫ縺ゅｊ</Badge>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-3 px-4 py-3">
            <SheetTrigger asChild>
              <button
                type="button"
                disabled={!ticket}
                className={`flex flex-1 flex-col items-start gap-1 rounded-lg p-2 text-left transition-colors ${
                  ticket ? "hover:bg-muted/40" : "cursor-not-allowed opacity-60"
                }`}
              >
                <span className="text-xs text-muted-foreground">
                  {ticket ? `莨晉･ｨ #${ticket.ticketNumber} ﾂｷ ${posStatus}` : "莨晉･ｨ繧帝∈謚槭＠縺ｦ縺上□縺輔＞"}
                </span>
                <span className="text-base font-bold">
                  {ticket ? `${combinedItems}轤ｹ ﾂｷ ﾂ･${combinedTotal.toLocaleString()}` : "-"}
                </span>
              </button>
            </SheetTrigger>

            <Button
              variant="outline"
              className="h-12"
              onClick={handleSaveDraft}
              disabled={!canAddLineItems || cart.length === 0 || addItemsMutation.isPending}
            >
              荳譎ゆｿ晏ｭ・
            </Button>
            <Button
              className="h-12"
              onClick={handleStartPayment}
              disabled={!ticket || isMemoOnly || lockMutation.isPending || isSubmittingPayment}
            >
              <Wallet className="w-4 h-4 mr-2" />
              謾ｯ謇輔＞
            </Button>
          </div>
        </div>

        {/* Details Sheet */}
        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-0 pb-6">
          <SheetHeader className="border-b">
            <SheetTitle>譏守ｴｰ</SheetTitle>
            <SheetDescription>
              {ticket
                ? `莨晉･ｨ #${ticket.ticketNumber}${ticket.tableLabel ? ` ﾂｷ ${ticket.tableLabel}` : ""} ﾂｷ ${ticket.partySize}蜷港
                : "莨晉･ｨ繧帝∈謚槭☆繧九→縲∵・邏ｰ縺ｨ莨夊ｨ医′陦ｨ遉ｺ縺輔ｌ縺ｾ縺吶・}
            </SheetDescription>
          </SheetHeader>

          {!ticket ? (
            <div className="p-4 text-center text-muted-foreground">
              莨晉･ｨ繧帝∈謚槭＠縺ｦ縺上□縺輔＞縲・
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pt-4">
              <Card className="flex min-h-0 flex-1 flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      譏守ｴｰ <Badge variant="outline">{combinedItems}轤ｹ</Badge>
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
                        莨晉･ｨ邱ｨ髮・
                      </Button>
                      {posStatus === "PAYMENT_LOCKED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unlockMutation.mutate({ storeId: storeIdNum, ticketId: ticket.id })}
                          disabled={unlockMutation.isPending}
                        >
                          繝ｭ繝・け隗｣髯､
                        </Button>
                      )}
                    </div>
                  </CardTitle>
                  <CardDescription>
                    莨晉･ｨ #{ticket.ticketNumber}
                    {ticket.tableLabel ? ` ﾂｷ ${ticket.tableLabel}` : ""}
                    {` ﾂｷ ${ticket.partySize}蜷港}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
                  {isMemoOnly && (
                    <div className="space-y-3 rounded-lg border bg-amber-50 p-3">
                      <div className="text-sm font-medium">繝｡繝｢</div>
                      <Textarea
                        value={memoDraft}
                        onChange={(e) => setMemoDraft(e.target.value)}
                        placeholder="蜿｣鬆ｭ繝｡繝｢繧貞・蜉幢ｼ井ｾ・ 辟ｼ縺榊刈貂帙√い繝ｬ繝ｫ繧ｮ繝ｼ縺ｪ縺ｩ・・
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
                          繝｡繝｢繧剃ｿ晏ｭ・
                        </Button>
                        <Button
                          onClick={() => markItemizedMutation.mutate({ storeId: storeIdNum, ticketId: ticket.id })}
                          disabled={markItemizedMutation.isPending || isLocked}
                        >
                          譏守ｴｰ蜈･蜉帙↓蛻・ｊ譖ｿ縺医ｋ
                        </Button>
                      </div>
                    </div>
                  )}

                  <ScrollArea className="flex-1 min-h-0 pr-3">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">譛ｪ邊ｾ邂暦ｼ域里蟄假ｼ・/div>
                        {unpaidOrders.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-2">譛ｪ邊ｾ邂玲・邏ｰ縺ｯ縺ゅｊ縺ｾ縺帙ｓ</div>
                        ) : (
                          unpaidOrders.flatMap((order) =>
                            (order.items ?? []).map((it) => (
                              <div key={`p-${order.id}-${it.id}`} className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="font-medium line-clamp-1">
                                    {it.menuItem?.name ?? `蝠・刀#${it.menuItemId}`}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    x{it.quantity} ﾂｷ ﾂ･{Number(it.subtotal ?? 0).toLocaleString()}
                                  </div>
                                </div>
                                <Badge variant="secondary">遒ｺ螳壽ｸ・/Badge>
                              </div>
                            ))
                          )
                        )}
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">霑ｽ蜉・域悴菫晏ｭ假ｼ・/div>
                        {cart.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-2">霑ｽ蜉縺ｯ縺ゅｊ縺ｾ縺帙ｓ</div>
                        ) : (
                          cart.map((c) => (
                            <div
                              key={`d-${c.menuItemId}`}
                              className="flex items-center justify-between gap-3 rounded-lg border bg-background p-2"
                            >
                              <div className="min-w-0">
                                <div className="font-medium line-clamp-1">{c.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  ﾂ･{(c.price * c.quantity).toLocaleString()}
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
                                  <Plus className="w-4 h-4" />
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
                    <span className="text-muted-foreground">譌｢蟄伜粋險・/span>
                    <span className="font-semibold">ﾂ･{persistedTotalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">霑ｽ蜉蜷郁ｨ・/span>
                    <span className="font-semibold">ﾂ･{draftTotalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-base">
                    <span className="font-semibold">蜷郁ｨ茨ｼ育ｨ手ｾｼ・・/span>
                    <span className="text-xl font-bold text-primary">ﾂ･{combinedTotal.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="h-12 flex-1"
                      onClick={handleSaveDraft}
                      disabled={!canAddLineItems || cart.length === 0 || addItemsMutation.isPending}
                    >
                      荳譎ゆｿ晏ｭ・
                    </Button>
                    <Button
                      className="h-12 flex-1"
                      onClick={handleStartPayment}
                      disabled={!ticket || isMemoOnly || lockMutation.isPending || isSubmittingPayment}
                    >
                      <Wallet className="w-4 h-4 mr-2" />
                      謾ｯ謇輔＞
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Ticket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createKind === "DINE_IN" ? "蠎怜・莨晉･ｨ繧剃ｽ懈・" : "繝｡繝｢莨晉･ｨ繧剃ｽ懈・"}
            </DialogTitle>
            <DialogDescription>蠢・ｦ・・岼繧貞・蜉帙＠縺ｦ菴懈・縺励∪縺吶・/DialogDescription>
          </DialogHeader>
                <div className="space-y-4">
            {createKind === "DINE_IN" && (
              <div className="space-y-2">
                <Label htmlFor="create-party-size">莠ｺ謨ｰ</Label>
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
              <Label htmlFor="create-table-label">繝・・繝悶Ν蜷搾ｼ井ｻｻ諢擾ｼ・/Label>
              <Input
                id="create-table-label"
                value={createTableLabel}
                onChange={(e) => setCreateTableLabel(e.target.value)}
                placeholder="萓・ T-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-guest-name">鬘ｧ螳｢蜷搾ｼ井ｻｻ諢擾ｼ・/Label>
              <Input
                id="create-guest-name"
                value={createGuestName}
                onChange={(e) => setCreateGuestName(e.target.value)}
                placeholder="萓・ 螻ｱ逕ｰ讒・
              />
            </div>
            {createKind === "MEMO_ONLY" && (
              <div className="space-y-2">
                <Label htmlFor="create-memo-text">繝｡繝｢・井ｻｻ諢擾ｼ・/Label>
                <Textarea
                  id="create-memo-text"
                  value={createMemoText}
                  onChange={(e) => setCreateMemoText(e.target.value)}
                  placeholder="蜿｣鬆ｭ繝｡繝｢縺ｪ縺ｩ"
                  rows={4}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              繧ｭ繝｣繝ｳ繧ｻ繝ｫ
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createTicketMutation.isPending}>
              菴懈・
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meta Dialog */}
      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>莨晉･ｨ邱ｨ髮・/DialogTitle>
            <DialogDescription>繝・・繝悶Ν蜷阪・莠ｺ謨ｰ縺ｪ縺ｩ繧呈峩譁ｰ縺励∪縺吶・/DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="meta-table-label">繝・・繝悶Ν蜷・/Label>
              <Input
                id="meta-table-label"
                value={metaTableLabel}
                onChange={(e) => setMetaTableLabel(e.target.value)}
                placeholder="萓・ T-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-party-size">莠ｺ謨ｰ</Label>
              <Input
                id="meta-party-size"
                type="number"
                min={1}
                value={metaPartySize}
                onChange={(e) => setMetaPartySize(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta-guest-name">鬘ｧ螳｢蜷・/Label>
              <Input
                id="meta-guest-name"
                value={metaGuestName}
                onChange={(e) => setMetaGuestName(e.target.value)}
                placeholder="萓・ 螻ｱ逕ｰ讒・
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMetaOpen(false)}>
              繧ｭ繝｣繝ｳ繧ｻ繝ｫ
            </Button>
            <Button onClick={handleSubmitMeta} disabled={updateMetaMutation.isPending || !canEditTicket}>
              菫晏ｭ・
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
            <DialogTitle>謾ｯ謇輔＞</DialogTitle>
            <DialogDescription>
              莨晉･ｨ #{ticket?.ticketNumber ?? "-"} 縺ｮ莨夊ｨ医ｒ遒ｺ螳壹＠縺ｾ縺吶・
            </DialogDescription>
          </DialogHeader>

          {completed ? (
            <div className="space-y-6">
                  <Card>
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2 text-green-700">
                    <CheckCircle2 className="w-6 h-6" />
                    縺贋ｼ夊ｨ医ｒ螳御ｺ・＠縺ｾ縺励◆
                      </CardTitle>
                  <CardDescription>莨夊ｨ育ｵ先棡</CardDescription>
                    </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="text-sm text-muted-foreground">蜷郁ｨ・/div>
                    <div className="text-4xl font-bold">ﾂ･{completed.totalAmount.toLocaleString()}</div>
                        </div>
                  {completed.changeAmount !== undefined && (
                    <div className="text-center space-y-2">
                      <div className="text-sm text-muted-foreground">縺翫▽繧・/div>
                      <div className="text-5xl font-bold text-primary">ﾂ･{completed.changeAmount.toLocaleString()}</div>
                        </div>
                      )}
                </CardContent>
              </Card>
              <DialogFooter>
                      <Button
                  onClick={() => setPaymentOpen(false)}
                  className="w-full sm:w-auto"
                >
                  髢峨§繧・
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {needsLock && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">莨夊ｨ磯幕蟋具ｼ医Ο繝・け・・/CardTitle>
                    <CardDescription>莨夊ｨ井ｸｭ縺ｯ莉也ｫｯ譛ｫ縺九ｉ縺ｮ邱ｨ髮・霑ｽ蜉繧貞宛髯舌＠縺ｾ縺吶・/CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => ticket && lockMutation.mutate({ storeId: storeIdNum, ticketId: ticket.id })}
                      disabled={isSubmittingPayment}
                    >
                      莨夊ｨ医ｒ髢句ｧ九☆繧・
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPaymentOpen(false)}
                      disabled={isSubmittingPayment}
                    >
                      髢峨§繧・
                      </Button>
                    </CardContent>
                  </Card>
              )}

              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                      <Wallet className="w-5 h-5" />
                      莨夊ｨ亥ｯｾ雎｡
                      </CardTitle>
                    <CardDescription>譛ｪ邊ｾ邂励・譏守ｴｰ蜷郁ｨ医〒縺・/CardDescription>
                    </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">蜷郁ｨ茨ｼ育ｨ手ｾｼ・・/span>
                      <span className="text-xl font-bold text-primary">ﾂ･{persistedTotalAmount.toLocaleString()}</span>
                    </div>
                    <Separator />
                    <div className="text-xs text-muted-foreground">
                      繝ｭ繝・け荳ｭ縺ｮ縺ｿ遒ｺ螳壹〒縺阪∪縺吶・
                      </div>
                    </CardContent>
                  </Card>

              <Card>
                <CardHeader>
                    <CardTitle>迴ｾ驥・/CardTitle>
                    <CardDescription>蜿怜叙驥鷹｡阪ｒ蜈･蜉帙＠縺ｦ遒ｺ螳壹＠縺ｾ縺・/CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">蜿怜叙驥鷹｡・/div>
                        <Input
                          type="number"
                          min={0}
                          value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder="萓・ 10000"
                        disabled={isSubmittingPayment || needsLock}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">縺翫▽繧・/span>
                        <span className={`font-semibold ${changeAmount < 0 ? "text-destructive" : "text-foreground"}`}>
                        {cashReceived ? (
                          changeAmount >= 0
                            ? `ﾂ･${changeAmount.toLocaleString()}`
                            : `荳崎ｶｳ ﾂ･${Math.abs(changeAmount).toLocaleString()}`
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
                      迴ｾ驥代〒遒ｺ螳・
                  </Button>
                </CardContent>
              </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>謇句虚遒ｺ螳・/CardTitle>
                  <CardDescription>螟夜ΚPOS/繧ｫ繝ｼ繝臥ｭ峨〒謾ｯ謇輔＞貂医∩縺ｮ蝣ｴ蜷・/CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup value={manualMethod} onValueChange={setManualMethod} className="space-y-2">
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="card" id="register-manual-card" />
                      <span className="text-sm font-medium">繧ｫ繝ｼ繝・/span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="qr" id="register-manual-qr" />
                      <span className="text-sm font-medium">QR豎ｺ貂・/span>
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-3">
                      <RadioGroupItem value="external" id="register-manual-external" />
                      <span className="text-sm font-medium">螟夜ΚPOS・域焔蜍慕｢ｺ螳夲ｼ・/span>
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
                    謇句虚縺ｧ遒ｺ螳・
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

