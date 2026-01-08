import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMenuCart, type MenuItem } from "@/hooks/useMenuCart";
import { filterMenuItems } from "@/lib/menuFilter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Plus, Minus, Trash2, Search } from "lucide-react";
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
};

export default function HandheldOrder() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = Number.parseInt(storeId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();

  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

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
  const filteredItems = useMemo(
    () => filterMenuItems(items as MenuItem[] | undefined, { categoryId: activeCategory }),
    [items, activeCategory]
  );

  const addItemsMutation = trpc.ticket.addItemsToTicket.useMutation({
    onSuccess: () => {
      toast.success("豕ｨ譁・ｒ騾∽ｿ｡縺励∪縺励◆");
      clearCart();
    },
    onError: (e) => toast.error(e.message),
  });

  const canSubmit = Boolean(selectedTicketId) && cart.length > 0;
  const handheldEnabled = Boolean(store?.enableHandheld);

  const handleSubmit = async () => {
    if (!selectedTicketId) {
      toast.error("莨晉･ｨ繧帝∈謚槭＠縺ｦ縺上□縺輔＞");
      return;
    }
    if (cart.length === 0) {
      toast.error("繧ｫ繝ｼ繝医′遨ｺ縺ｧ縺・);
      return;
    }
    await addItemsMutation.mutateAsync({
      storeId: storeIdNum,
      ticketId: Number.parseInt(selectedTicketId, 10),
      items: cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
      })),
      entrySource: "staff_handheld",
      routeToKitchen: true,
    });
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>蠎苓・縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ</CardTitle>
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
            <CardTitle>繝上Φ繝・ぅ讖溯・縺檎┌蜉ｹ縺ｧ縺・/CardTitle>
            <CardDescription>
              蠎苓・險ｭ螳壹〒 `enableHandheld` 繧呈怏蜉ｹ縺ｫ縺励※縺上□縺輔＞縲・
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link href="/staff" className="flex-1">
              <Button variant="outline" className="w-full">繧ｹ繧ｿ繝・ヵ蜈･蜿｣縺ｸ</Button>
            </Link>
            <Link href={`/settings/${storeIdNum}`} className="flex-1">
              <Button className="w-full">蠎苓・險ｭ螳壹∈</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href="/staff">
              <Button variant="ghost" size="icon" aria-label="謌ｻ繧・>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="leading-tight">
              <div className="font-semibold">繝上Φ繝・ぅ豕ｨ譁・/div>
              <div className="text-xs text-muted-foreground">{store.name}</div>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetchTickets()} disabled={ticketsLoading}>
            蜀崎ｪｭ霎ｼ
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4 pb-32">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>莨晉･ｨ驕ｸ謚・/CardTitle>
            <CardDescription>Open 縺ｮ莨晉･ｨ縺ｮ縺ｿ驕ｸ謚槭〒縺阪∪縺・/CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>讀懃ｴ｢</Label>
              <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  placeholder="莨晉･ｨ逡ｪ蜿ｷ / 繝・・繝悶Ν / 鬘ｧ螳｢蜷・
                  className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>莨晉･ｨ</Label>
              <Select value={selectedTicketId} onValueChange={setSelectedTicketId}>
                <SelectTrigger>
                  <SelectValue placeholder="莨晉･ｨ繧帝∈謚槭＠縺ｦ縺上□縺輔＞" />
                </SelectTrigger>
                <SelectContent>
                  {availableTickets.length === 0 ? (
                    <SelectItem value="no-tickets" disabled>
                      Open 縺ｮ莨晉･ｨ縺後≠繧翫∪縺帙ｓ
                    </SelectItem>
                  ) : (
                    availableTickets.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        #{t.ticketNumber}
                        {t.tableLabel ? ` ﾂｷ ${t.tableLabel}` : ""}
                        {t.guestName ? ` ﾂｷ ${t.guestName}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedTicket && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {selectedTicket.unpaidItemsCount ?? 0}轤ｹ / ﾂ･{Number(selectedTicket.unpaidTotalAmount ?? 0).toLocaleString()}
                  </span>
                  <Badge variant="outline">{selectedTicket.posStatus}</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>繝｡繝九Η繝ｼ</CardTitle>
            <CardDescription>繧ｿ繝・・縺ｧ繧ｫ繝ｼ繝医↓霑ｽ蜉縺励∪縺・/CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <ScrollArea className="w-full">
                <TabsList className="inline-flex h-auto p-1 bg-muted/50">
                  <TabsTrigger value="all" className="rounded-full px-5 py-3 data-[state=active]:bg-primary data-[state=active]:text-white">
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

            <div className="grid gap-3 sm:grid-cols-2">
              {filteredItems.map((item) => {
                const isSoldOut = !item.isAvailable || (item.stockCount !== null && item.stockCount <= 0);
                const cartItem = cart.find((c) => c.menuItemId === item.id);
                return (
                  <Card key={item.id} className={`${isSoldOut ? "opacity-60" : ""}`}>
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium line-clamp-2">{item.name}</div>
                        <div className="text-sm text-primary font-bold">
                          ﾂ･{Number(item.price).toLocaleString()}
                        </div>
                        {cartItem && (
                          <Badge variant="secondary" className="mt-2">
                            {cartItem.quantity}轤ｹ
                          </Badge>
                        )}
                      </div>
                      {!cartItem ? (
                        <Button
                          className="h-12 px-6"
                          onClick={() => addToCart(item)}
                          disabled={isSoldOut}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          霑ｽ蜉
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-full"
                            onClick={() => {
                              if (cartItem.quantity === 1) removeFromCart(cartItem.menuItemId);
                              else updateQuantity(cartItem.menuItemId, -1);
                            }}
                          >
                            {cartItem.quantity === 1 ? (
                              <Trash2 className="h-5 w-5 text-red-500" />
                            ) : (
                              <Minus className="h-5 w-5" />
                            )}
                          </Button>
                          <div className="w-10 text-center font-bold text-lg">{cartItem.quantity}</div>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-full"
                            onClick={() => updateQuantity(cartItem.menuItemId, 1)}
                          >
                            <Plus className="h-5 w-5" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">繧ｫ繝ｼ繝・/span>
            <span className="font-semibold">
              {totalItems}轤ｹ ﾂｷ ﾂ･{totalAmount.toLocaleString()}
            </span>
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={clearCart}
              disabled={cart.length === 0 || addItemsMutation.isPending}
            >
              繧ｯ繝ｪ繧｢
            </Button>
            <Button
              className="flex-1 h-12"
              onClick={handleSubmit}
              disabled={!canSubmit || addItemsMutation.isPending}
            >
              {addItemsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  騾∽ｿ｡荳ｭ...
                </>
              ) : (
                "騾∽ｿ｡"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}



