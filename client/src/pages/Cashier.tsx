import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CartBuilder, CartDetailContent } from "@/components/Register/CartBuilder";
import { useMenuCart, type MenuItem } from "@/hooks/useMenuCart";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
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

  const isSubmitting = createPartyMutation.isPending || createOrderMutation.isPending;
  const partySizeNumber = parseInt(newPartySize, 10);
  const canSubmit =
    cart.length > 0 &&
    (partyMode === "existing" ? Boolean(selectedPartyId) : partySizeNumber > 0);

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error("繧ｫ繝ｼ繝医′遨ｺ縺ｧ縺・);
      return;
    }

    let partyId: number | null = null;

    try {
      if (partyMode === "existing") {
        if (!selectedPartyId) {
          toast.error("豕ｨ譁・・縺ｮ蜿嶺ｻ倥ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞");
          return;
        }
        partyId = parseInt(selectedPartyId, 10);
      } else {
        if (!partySizeNumber || partySizeNumber < 1) {
          toast.error("莠ｺ謨ｰ繧貞・蜉帙＠縺ｦ縺上□縺輔＞");
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
        toast.error("蜿嶺ｻ俶ュ蝣ｱ縺ｮ蜿門ｾ励↓螟ｱ謨励＠縺ｾ縺励◆");
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

      toast.success("豕ｨ譁・ｒ遒ｺ螳壹＠縺ｾ縺励◆");
      clearCart();
      setNotes("");

      if (partyMode === "new") {
        setPartyMode("existing");
        setSelectedPartyId(String(partyId));
        setNewPartyName("");
        setNewPartySize("2");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "豕ｨ譁・・菴懈・縺ｫ螟ｱ謨励＠縺ｾ縺励◆";
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
    <div className="flex -m-4 h-[calc(100svh-3.5rem)] min-h-0 flex-col bg-background overflow-hidden md:m-0 md:h-[100svh]">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href={`/queue/${storeIdNum}`}>
              <Button variant="ghost" size="icon" aria-label="謌ｻ繧・>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="leading-tight">
              <div className="font-semibold">豕ｨ譁・女莉・/div>
              <div className="text-xs text-muted-foreground">
                {store?.name ?? "蠎苓・"}
              </div>
            </div>
          </div>
        </div>
      </header>

      <Sheet>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <CartBuilder
            categories={categories as Category[] | undefined}
            items={items as MenuItem[] | undefined}
            cart={cart}
            totalAmount={totalAmount}
            totalItems={totalItems}
            notes={notes}
            onNotesChange={setNotes}
            onAddToCart={addToCart}
            onUpdateQuantity={updateQuantity}
            onRemoveFromCart={removeFromCart}
            onClearCart={clearCart}
            sidebarHeader={(
              <Card>
                <CardHeader>
                  <CardTitle>豕ｨ譁・・</CardTitle>
                  <CardDescription>隱ｰ縺ｮ豕ｨ譁・→縺励※逋ｻ骭ｲ縺励∪縺吶°</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScrollArea>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={partyMode === "existing" ? "default" : "outline"}
                        onClick={() => setPartyMode("existing")}
                      >
                        譌｢蟄伜女莉・                      </Button>
                      <Button
                        type="button"
                        variant={partyMode === "new" ? "default" : "outline"}
                        onClick={() => setPartyMode("new")}
                      >
                        譁ｰ隕丞女莉・                      </Button>
                    </div>
                  </ScrollArea>

                  {partyMode === "existing" ? (
                    <div className="space-y-2">
                      <Label>蜿嶺ｻ倥ｒ驕ｸ謚・/Label>
                      <Select
                        value={selectedPartyId}
                        onValueChange={setSelectedPartyId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="蜿嶺ｻ倥ｒ驕ｸ謚槭＠縺ｦ縺上□縺輔＞" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableParties.length === 0 && (
                            <SelectItem value="no-parties" disabled>
                              蟇ｾ雎｡縺ｮ蜿嶺ｻ倥′縺ゅｊ縺ｾ縺帙ｓ
                            </SelectItem>
                          )}
                          {availableParties.map((party) => (
                            <SelectItem key={party.id} value={party.id.toString()}>
                              #{party.ticketNumber} {party.guestName ?? "縺雁ｮ｢讒・} (
                              {party.partySize}蜷・
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="guestName">縺雁錐蜑搾ｼ井ｻｻ諢擾ｼ・/Label>
                        <Input
                          id="guestName"
                          value={newPartyName}
                          onChange={(event) => setNewPartyName(event.target.value)}
                          placeholder="萓・ 螻ｱ逕ｰ讒・
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="partySize">莠ｺ謨ｰ</Label>
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
            )}
          />
        </div>

        <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center gap-3 px-4 py-3">
            <SheetTrigger asChild>
              <button
                type="button"
                className="flex flex-1 flex-col items-start gap-1 rounded-lg p-2 text-left hover:bg-muted/40 lg:hidden"
              >
                <span className="text-xs text-muted-foreground">
                  繧ｿ繝・・縺励※繧ｫ繝ｼ繝医ｒ遒ｺ隱・                </span>
                <span className="text-base font-bold">
                  {totalItems}轤ｹ ﾂｷ ﾂ･{totalAmount.toLocaleString()}
                </span>
              </button>
            </SheetTrigger>

            <div className="hidden lg:flex flex-1 items-center gap-6">
              <div>
                <p className="text-sm text-muted-foreground">蜷郁ｨ育せ謨ｰ</p>
                <p className="text-xl font-bold">{totalItems}轤ｹ</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">蜷郁ｨ磯≡鬘・/p>
                <p className="text-xl font-bold text-primary">
                  ﾂ･{totalAmount.toLocaleString()}
                </p>
              </div>
            </div>

            <Button
              size="lg"
              className="h-12 px-6"
              onClick={handleSubmitOrder}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  蜃ｦ逅・ｸｭ
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  豕ｨ譁・｢ｺ螳・                </>
              )}
            </Button>
          </div>
        </div>

        <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl px-0 pb-6">
          <SheetHeader className="border-b px-4">
            <SheetTitle>繧ｫ繝ｼ繝・/SheetTitle>
            <SheetDescription>豕ｨ譁・・螳ｹ繧堤｢ｺ隱阪〒縺阪∪縺・/SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 px-4">
            <CartDetailContent
              cart={cart}
              notes={notes}
              totalAmount={totalAmount}
              onNotesChange={setNotes}
              onUpdateQuantity={updateQuantity}
              onRemoveFromCart={removeFromCart}
              onClearCart={clearCart}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
