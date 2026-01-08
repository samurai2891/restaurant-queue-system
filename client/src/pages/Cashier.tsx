import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMenuCart, type MenuItem } from "@/hooks/useMenuCart";
import { ToppingDialog, type ToppingDialogResult } from "@/components/order/ToppingDialog";
import { CartPanel } from "@/components/order/CartPanel";
import { ElapsedTimeCompact } from "@/components/order/ElapsedTime";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  Trash2,
  Clock,
  AlertTriangle,
  Timer,
  Bell,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

type PartyStatus = "waiting" | "notified" | "arrived" | "seated" | "canceled" | "noshow";

type PartyOption = {
  id: number;
  ticketNumber: number;
  guestName?: string | null;
  partySize: number;
  status: PartyStatus;
  seatedAt?: string | null;
  allergies?: string | null;
  notes?: string | null;
};

// ラストオーダー設定型
type LastOrderConfig = {
  partyId: number;
  lastOrderTime: Date;
  notifiedAt?: Date;
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
  const [isOrderTargetExpanded, setIsOrderTargetExpanded] = useState(false);

  // Topping Dialog
  const [toppingDialogOpen, setToppingDialogOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);

  // Last Order Management
  const [lastOrderConfigs, setLastOrderConfigs] = useState<Map<number, LastOrderConfig>>(new Map());
  const [lastOrderDialogOpen, setLastOrderDialogOpen] = useState(false);
  const [lastOrderMinutes, setLastOrderMinutes] = useState("60");

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
        (party) => party.status === "waiting" || party.status === "arrived" || party.status === "seated"
      ) ?? [],
    [parties]
  );

  const selectedParty = useMemo(() => {
    if (!selectedPartyId) return undefined;
    return availableParties.find((p) => p.id.toString() === selectedPartyId);
  }, [availableParties, selectedPartyId]);

  const selectedPartyLabel = useMemo(() => {
    if (partyMode === "existing") {
      if (!selectedPartyId) return "未選択";
      const party = availableParties.find((p) => p.id.toString() === selectedPartyId);
      if (!party) return "未選択";
      return `#${party.ticketNumber} ${party.guestName ?? "お客様"} (${party.partySize}名)`;
    }
    const name = newPartyName || "お客様";
    return `${name} (${newPartySize}名)`;
  }, [partyMode, selectedPartyId, availableParties, newPartyName, newPartySize]);

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

  // ラストオーダーチェック（１分ごと）
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      // 現在の lastOrderConfigs を取得するために関数形式で更新
      setLastOrderConfigs((prev) => {
        const next = new Map(prev);
        let hasChanges = false;

        prev.forEach((config, partyId) => {
          const remainingMs = config.lastOrderTime.getTime() - now.getTime();
          const remainingMinutes = Math.floor(remainingMs / 60000);

          // 5分前に通知
          if (remainingMinutes <= 5 && remainingMinutes > 0 && !config.notifiedAt) {
            const party = availableParties.find((p) => p.id === partyId);
            toast.warning(`ラストオーダー5分前: #${party?.ticketNumber ?? partyId}`, {
              icon: <Bell className="w-5 h-5 text-amber-500" />,
              duration: 10000,
            });
            next.set(partyId, { ...config, notifiedAt: now });
            hasChanges = true;
          }

          // ラストオーダー時間到達
          if (remainingMinutes <= 0 && config.notifiedAt && (now.getTime() - config.notifiedAt.getTime()) > 60000) {
            const party = availableParties.find((p) => p.id === partyId);
            toast.error(`ラストオーダー時間です: #${party?.ticketNumber ?? partyId}`, {
              icon: <Timer className="w-5 h-5 text-red-500" />,
              duration: 15000,
            });
            next.delete(partyId);
            hasChanges = true;
          }
        });

        return hasChanges ? next : prev;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [availableParties]);

  // メニューアイテムクリック時
  const handleMenuItemClick = (item: MenuItem) => {
    const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);
    if (isSoldOut) return;

    // トッピングダイアログを表示
    setSelectedMenuItem(item);
    setToppingDialogOpen(true);
  };

  // トッピング選択後
  const handleToppingConfirm = (result: ToppingDialogResult) => {
    if (!selectedMenuItem) return;
    addToCart(selectedMenuItem, {
      modifiers: result.modifiers,
      notes: result.notes,
    });
    setSelectedMenuItem(null);
  };

  // ラストオーダー設定
  const handleSetLastOrder = () => {
    if (!selectedPartyId) return;
    const partyId = Number.parseInt(selectedPartyId, 10);
    const minutes = Number.parseInt(lastOrderMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return;

    const lastOrderTime = new Date(Date.now() + minutes * 60000);
    setLastOrderConfigs((prev) => {
      const next = new Map(prev);
      next.set(partyId, { partyId, lastOrderTime });
      return next;
    });

    toast.success(`ラストオーダーを${minutes}分後に設定しました`);
    setLastOrderDialogOpen(false);
  };

  // ラストオーダー残り時間取得
  const getLastOrderRemaining = (partyId: number): string | null => {
    const config = lastOrderConfigs.get(partyId);
    if (!config) return null;

    const remainingMs = config.lastOrderTime.getTime() - Date.now();
    if (remainingMs <= 0) return "時間です";

    const minutes = Math.floor(remainingMs / 60000);
    if (minutes < 60) return `${minutes}分`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}時間${mins}分`;
  };

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
          modifiers: item.modifiers,
          notes: item.notes,
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
      {/* Topping Dialog */}
      <ToppingDialog
        open={toppingDialogOpen}
        onOpenChange={setToppingDialogOpen}
        menuItem={selectedMenuItem}
        onConfirm={handleToppingConfirm}
      />

      {/* Last Order Dialog */}
      <Dialog open={lastOrderDialogOpen} onOpenChange={setLastOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5" />
              ラストオーダー設定
            </DialogTitle>
            <DialogDescription>
              指定時間後にラストオーダーの通知を表示します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>何分後にラストオーダーですか？</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={lastOrderMinutes}
                  onChange={(e) => setLastOrderMinutes(e.target.value)}
                  min={1}
                  className="w-24"
                />
                <span className="text-muted-foreground">分後</span>
              </div>
            </div>
            <div className="flex gap-2">
              {[30, 45, 60, 90].map((min) => (
                <Button
                  key={min}
                  variant={lastOrderMinutes === String(min) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLastOrderMinutes(String(min))}
                >
                  {min}分
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLastOrderDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSetLastOrder}>
              設定する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {/* 注文先選択 */}
            <div className="shrink-0 p-3 lg:p-4 space-y-4">
              {/* スマホ用: 折りたたみ可能なコンパクト表示 */}
              <div className="lg:hidden">
                <Collapsible open={isOrderTargetExpanded} onOpenChange={setIsOrderTargetExpanded}>
                  <Card>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full text-left p-3 flex items-center justify-between hover:bg-muted/50 rounded-lg transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="text-xs text-muted-foreground font-medium">
                            {partyMode === "existing" ? "既存受付" : "新規受付"}
                          </div>
                          <div className="font-semibold text-sm">{selectedPartyLabel}</div>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                            isOrderTargetExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-3 space-y-3">
                        <Separator />
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
                              <Label htmlFor="guestNameMobile">お名前（任意）</Label>
                              <Input
                                id="guestNameMobile"
                                value={newPartyName}
                                onChange={(event) => setNewPartyName(event.target.value)}
                                placeholder="例: 山田様"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="partySizeMobile">人数</Label>
                              <Input
                                id="partySizeMobile"
                                type="number"
                                min={1}
                                value={newPartySize}
                                onChange={(event) => setNewPartySize(event.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </div>

              {/* PC用: 常に展開表示 */}
              <div className="hidden lg:block">
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
                            {availableParties.map((party) => {
                              const lastOrderRemaining = getLastOrderRemaining(party.id);
                              return (
                                <SelectItem key={party.id} value={party.id.toString()}>
                                  <div className="flex items-center justify-between w-full gap-2">
                                    <span>#{party.ticketNumber} {party.guestName ?? "お客様"} ({party.partySize}名)</span>
                                    {lastOrderRemaining && (
                                      <Badge variant="destructive" className="text-xs">
                                        LO {lastOrderRemaining}
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>

                        {/* 選択中の受付情報 */}
                        {selectedParty && (
                          <div className="space-y-2 pt-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">滞在時間</span>
                              {selectedParty.seatedAt && (
                                <ElapsedTimeCompact startTime={selectedParty.seatedAt} thresholdMinutes={90} />
                              )}
                            </div>
                            {selectedParty.allergies && (
                              <div className="flex items-center gap-2 text-sm text-amber-600">
                                <AlertTriangle className="w-4 h-4" />
                                <span>アレルギー: {selectedParty.allergies}</span>
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => setLastOrderDialogOpen(true)}
                            >
                              <Timer className="w-4 h-4 mr-2" />
                              ラストオーダー設定
                            </Button>
                            {lastOrderConfigs.has(Number(selectedPartyId)) && (
                              <div className="flex items-center justify-between text-sm bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                                <span className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                                  <Clock className="w-4 h-4" />
                                  ラストオーダーまで
                                </span>
                                <span className="font-bold text-amber-700 dark:text-amber-300">
                                  {getLastOrderRemaining(Number(selectedPartyId))}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
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
            </div>

            {/* カート詳細（PCのみ） */}
            <div className="hidden lg:flex flex-1 min-h-0 flex-col px-4 pb-4">
              <CartPanel
                cart={cart}
                totalAmount={totalAmount}
                totalItems={totalItems}
                notes={notes}
                onNotesChange={setNotes}
                onQuantityChange={(menuItemId, delta) => updateQuantity(menuItemId, delta)}
                onRemove={(menuItemId) => removeFromCart(menuItemId)}
                onClear={clearCart}
                showNotes={true}
              />
            </div>
          </div>

          {/* 右カラム */}
          <div className="flex min-h-0 flex-col">
            {/* カテゴリタブ */}
            <div className="shrink-0 p-2 lg:p-4 border-b sticky top-0 z-10 bg-background">
              <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                <ScrollArea className="w-full">
                  <TabsList className="inline-flex h-auto p-1 bg-muted/50">
                    <TabsTrigger
                      value="all"
                      className="rounded-full px-3 py-2 lg:px-5 lg:py-3 text-sm whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white"
                    >
                      すべて
                    </TabsTrigger>
                    {categories?.map((c) => (
                      <TabsTrigger
                        key={c.id}
                        value={String(c.id)}
                        className="rounded-full px-3 py-2 lg:px-5 lg:py-3 text-sm whitespace-nowrap data-[state=active]:bg-primary data-[state=active]:text-white"
                      >
                        {c.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </ScrollArea>
              </Tabs>
            </div>

            {/* メニューグリッド */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 lg:p-4">
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4 lg:gap-3">
                  {filteredItems.map((item) => {
                    const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);
                    const cartQty = cart
                      .filter((c) => c.menuItemId === item.id)
                      .reduce((sum, c) => sum + c.quantity, 0);
                    const inCart = cartQty > 0;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="text-left"
                        onClick={() => handleMenuItemClick(item)}
                        disabled={isSoldOut}
                      >
                        <Card
                          className={`h-full transition-all duration-200 ${
                            isSoldOut ? "opacity-60" : "hover:shadow-md"
                          } ${inCart ? "ring-2 ring-primary ring-offset-1 lg:ring-offset-2" : ""}`}
                        >
                          <CardContent className="p-2 lg:p-4 flex flex-col gap-2 lg:gap-3">
                            <div className="space-y-0.5 lg:space-y-1">
                              <div className="font-semibold text-sm lg:text-base line-clamp-2">{item.name}</div>
                              <div className="text-base lg:text-lg text-primary font-bold">
                                ¥{Number(item.price).toLocaleString()}
                              </div>
                              {isSoldOut && (
                                <Badge variant="secondary" className="text-xs">売切れ</Badge>
                              )}
                            </div>
                            {inCart && (
                              <div className="flex items-center justify-between gap-1 lg:gap-2 pt-2 border-t">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 lg:h-10 lg:w-10 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (cartQty === 1) removeFromCart(item.id);
                                    else updateQuantity(item.id, -1);
                                  }}
                                >
                                  {cartQty === 1 ? (
                                    <Trash2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-red-500" />
                                  ) : (
                                    <Minus className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                                  )}
                                </Button>
                                <div className="text-center font-bold text-base lg:text-lg">{cartQty}点</div>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8 lg:h-10 lg:w-10 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateQuantity(item.id, 1);
                                  }}
                                >
                                  <Plus className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
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
            {/* スマホ: カート概要 */}
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
            <CartPanel
              cart={cart}
              totalAmount={totalAmount}
              totalItems={totalItems}
              notes={notes}
              onNotesChange={setNotes}
              onQuantityChange={(menuItemId, delta) => updateQuantity(menuItemId, delta)}
              onRemove={(menuItemId) => removeFromCart(menuItemId)}
              onClear={clearCart}
              compact={true}
              showNotes={true}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
