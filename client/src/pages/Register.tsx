import { useAuth } from "@/_core/hooks/useAuth";
import { CartBuilder } from "@/components/Register/CartBuilder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useMenuCart, type MenuItem } from "@/hooks/useMenuCart";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  QrCode,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

type RegisterStep = "select" | "order" | "payment";

type PartyStatus = "waiting" | "notified" | "arrived" | "seated" | "canceled" | "noshow";

type PartyOption = {
  id: number;
  ticketNumber: number;
  guestName?: string | null;
  partySize: number;
  status: PartyStatus;
};

export default function Register() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [step, setStep] = useState<RegisterStep>("select");
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [qrGenerated, setQrGenerated] = useState(false);
  const [manualPaymentMethod, setManualPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");

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

  const { data: parties, isLoading: partiesLoading } = trpc.party.list.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0, refetchInterval: 5000 }
  );

  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = trpc.order.list.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0, refetchInterval: 5000 }
  );

  const createCheckoutOrderMutation = trpc.order.createForCheckout.useMutation();
  const confirmPaymentBatchMutation = trpc.order.confirmPaymentBatch.useMutation();

  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    totalAmount,
    totalItems,
  } = useMenuCart(items as MenuItem[] | undefined);

  const availableParties = useMemo(
    () =>
      (parties as PartyOption[] | undefined)?.filter(
        (party) => party.status !== "canceled" && party.status !== "noshow"
      ) ?? [],
    [parties]
  );

  const selectedParty = useMemo(() => {
    if (!selectedPartyId) return undefined;
    return availableParties.find((party) => party.id === parseInt(selectedPartyId, 10));
  }, [availableParties, selectedPartyId]);

  const unpaidOrders = useMemo(
    () => (orders ?? []).filter((order) => order.paymentStatus === "unpaid"),
    [orders]
  );

  const selectedPartyOrders = useMemo(() => {
    if (!selectedParty) return [];
    return unpaidOrders.filter((order) => order.partyId === selectedParty.id);
  }, [selectedParty, unpaidOrders]);

  const checkoutTotal = useMemo(
    () => selectedPartyOrders.reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0),
    [selectedPartyOrders]
  );

  const canProceedToOrder = Boolean(selectedPartyId);
  const hasCheckoutOrders = selectedPartyOrders.length > 0;
  const canGenerateQr = hasCheckoutOrders;
  const isCreatingCheckoutOrder = createCheckoutOrderMutation.isPending;
  const isConfirmingPayment = confirmPaymentBatchMutation.isPending;
  const isCashPayment = manualPaymentMethod === "cash";
  const cashReceivedNumber = cashReceived ? Number(cashReceived) : 0;
  const changeAmount = cashReceivedNumber - checkoutTotal;
  const canConfirmManualPayment = !isCashPayment || cashReceivedNumber >= checkoutTotal;

  useEffect(() => {
    if (!isCashPayment && cashReceived) {
      setCashReceived("");
    }
  }, [isCashPayment, cashReceived]);

  const handleCreateCheckoutOrder = async () => {
    if (!selectedPartyId) {
      toast.error("受付を選択してください");
      return;
    }
    if (cart.length === 0) {
      toast.error("注文内容を入力してください");
      return;
    }

    try {
      await createCheckoutOrderMutation.mutateAsync({
        storeId: storeIdNum,
        partyId: parseInt(selectedPartyId, 10),
        items: cart.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        })),
        notes: notes || undefined,
      });

      toast.success("会計用の注文を登録しました");
      clearCart();
      setNotes("");
      setQrGenerated(false);
      await refetchOrders();
      setStep("payment");
    } catch (error) {
      const message = error instanceof Error ? error.message : "注文登録に失敗しました";
      toast.error(message);
    }
  };

  const handleConfirmPayment = async (paymentMethod: string) => {
    if (!selectedParty) {
      toast.error("受付を選択してください");
      return;
    }
    if (selectedPartyOrders.length === 0) {
      toast.error("会計対象の注文がありません");
      return;
    }
    if (paymentMethod === "cash" && cashReceivedNumber < checkoutTotal) {
      toast.error("受取金額が不足しています");
      return;
    }

    try {
      await confirmPaymentBatchMutation.mutateAsync({
        storeId: storeIdNum,
        orderIds: selectedPartyOrders.map((order) => order.id),
        paymentMethod,
      });

      toast.success("会計を確定しました");
      setQrGenerated(false);
      setStep("select");
      setSelectedPartyId("");
      await refetchOrders();
    } catch (error) {
      const message = error instanceof Error ? error.message : "会計確定に失敗しました";
      toast.error(message);
    }
  };

  if (authLoading || storeLoading || partiesLoading || ordersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/queue/${storeIdNum}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">レジ</h1>
          <p className="text-sm text-muted-foreground">{store?.name ?? "店舗"}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-5 w-5" />
            <CardTitle>会計処理</CardTitle>
          </div>
          <CardDescription>
            Step Aで受付を選択し、Step Bで会計用の注文を入力後、Step CでQR決済を進めます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { key: "select", label: "Step A: 受付/テーブル選択" },
              { key: "order", label: "Step B: 注文入力" },
              { key: "payment", label: "Step C: QR決済" },
            ].map((item) => {
              const isActive = step === item.key;
              return (
                <div
                  key={item.key}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                    isActive ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </div>
              );
            })}
          </div>

          {step === "select" && (
            <div className="space-y-6">
              <Card className="border-muted">
                <CardHeader>
                  <CardTitle>受付を選択</CardTitle>
                  <CardDescription>会計対象の受付を選んでください。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>受付一覧</Label>
                    <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
                      <SelectTrigger>
                        <SelectValue placeholder="受付を選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableParties.length === 0 && (
                          <SelectItem value="no-parties" disabled>
                            受付がありません
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

                  <div className="rounded-lg border bg-muted/20 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">未精算注文</span>
                      <Badge variant="outline">{selectedPartyOrders.length}件</Badge>
                    </div>
                    <Separator className="my-3" />
                    {selectedPartyOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground">未精算の注文はありません。</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {selectedPartyOrders.map((order) => (
                          <div key={order.id} className="flex items-center justify-between">
                            <span className="text-muted-foreground">注文 #{order.orderNumber}</span>
                            <span className="font-medium">
                              ¥{Number(order.totalAmount ?? 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                        <Separator />
                        <div className="flex items-center justify-between text-base font-semibold">
                          <span>合計</span>
                          <span>¥{checkoutTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" asChild>
                      <Link href={`/queue/${storeIdNum}`}>キュー管理へ</Link>
                    </Button>
                    <Button onClick={() => setStep("order")} disabled={!canProceedToOrder}>
                      次へ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === "order" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">注文入力</h2>
                  <p className="text-sm text-muted-foreground">
                    会計時に追加する注文を入力します。
                  </p>
                </div>
                <Badge variant="outline">受付 #{selectedParty?.ticketNumber ?? "--"}</Badge>
              </div>

              <CartBuilder
                categories={categories as { id: number; name: string }[] | undefined}
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
                sidebarFooter={(
                  <Card>
                    <CardHeader>
                      <CardTitle>会計対象</CardTitle>
                      <CardDescription>既存の未精算注文も合算されます。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">既存未精算</span>
                        <span className="font-medium">¥{checkoutTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">今回追加</span>
                        <span className="font-medium">¥{totalAmount.toLocaleString()}</span>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between text-base font-semibold">
                        <span>合計見込み</span>
                        <span>¥{(checkoutTotal + totalAmount).toLocaleString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="outline" onClick={() => setStep("select")}>
                  Step Aへ戻る
                </Button>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {hasCheckoutOrders && cart.length === 0 && (
                    <Button variant="outline" onClick={() => setStep("payment")}>
                      注文入力をスキップ
                    </Button>
                  )}
                  <Button onClick={handleCreateCheckoutOrder} disabled={cart.length === 0 || isCreatingCheckoutOrder}>
                    {isCreatingCheckoutOrder ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登録中...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        注文確定
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "payment" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">QR決済</h2>
                  <p className="text-sm text-muted-foreground">
                    QRを生成し、支払い確認後に会計を確定します。
                  </p>
                </div>
                <Badge variant="outline">受付 #{selectedParty?.ticketNumber ?? "--"}</Badge>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Receipt className="h-4 w-4" />
                      会計対象の注文
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      {selectedPartyOrders.length === 0 ? (
                        <p className="text-muted-foreground">会計対象の注文がありません。</p>
                      ) : (
                        selectedPartyOrders.map((order) => (
                          <div key={order.id} className="flex items-center justify-between">
                            <span className="text-muted-foreground">注文 #{order.orderNumber}</span>
                            <span className="font-medium">
                              ¥{Number(order.totalAmount ?? 0).toLocaleString()}
                            </span>
                          </div>
                        ))
                      )}
                      <Separator />
                      <div className="flex items-center justify-between text-base font-semibold">
                        <span>合計</span>
                        <span>¥{checkoutTotal.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-background p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wallet className="h-4 w-4" />
                      支払方法
                    </div>
                    <RadioGroup value="qr" className="mt-4 space-y-3">
                      <div className="flex items-center space-x-2 rounded-md border p-3">
                        <RadioGroupItem value="qr" id="payment-qr" />
                        <Label htmlFor="payment-qr" className="flex-1">
                          QR決済
                        </Label>
                        <span className="text-xs text-muted-foreground">Pay/IC</span>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        QR生成
                      </CardTitle>
                      <CardDescription>お客様に提示するQRを生成します。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {qrGenerated ? (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                          QRコードを表示中
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                          QRを生成してお客様に提示してください
                        </div>
                      )}
                      <Button
                        className="w-full"
                        onClick={() => setQrGenerated(true)}
                        disabled={!canGenerateQr}
                      >
                        QRを生成
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5" />
                        支払い確認
                      </CardTitle>
                      <CardDescription>QR決済の完了を確認します。</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Button
                        className="w-full"
                        onClick={() => handleConfirmPayment("qr")}
                        disabled={!qrGenerated || !canGenerateQr || isConfirmingPayment}
                      >
                        {isConfirmingPayment ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            確認中...
                          </>
                        ) : (
                          "支払い確認"
                        )}
                      </Button>
                      <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                        QR決済が確認できない場合は、手動で会計を確定してください。
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    手動確定
                  </CardTitle>
                  <CardDescription>現金やカードで支払い済みの場合に使用します。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>支払方法</Label>
                    <RadioGroup
                      value={manualPaymentMethod}
                      onValueChange={setManualPaymentMethod}
                      className="space-y-2"
                    >
                      <label className="flex items-center gap-2 rounded-md border p-3">
                        <RadioGroupItem value="cash" id="manual-payment-cash" />
                        <span className="text-sm font-medium">現金</span>
                        <Badge variant="secondary" className="ml-auto">推奨</Badge>
                      </label>
                      <label className="flex items-center gap-2 rounded-md border p-3">
                        <RadioGroupItem value="card" id="manual-payment-card" />
                        <span className="text-sm font-medium">クレジットカード</span>
                      </label>
                    </RadioGroup>
                  </div>
                  {isCashPayment && (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                      <div className="space-y-2">
                        <Label htmlFor="register-cash-received">受取金額</Label>
                        <Input
                          id="register-cash-received"
                          type="number"
                          min={0}
                          value={cashReceived}
                          onChange={(event) => setCashReceived(event.target.value)}
                          placeholder="例: 5000"
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">お釣り</span>
                        <span className={`font-semibold ${changeAmount < 0 ? "text-destructive" : "text-foreground"}`}>
                          {changeAmount >= 0
                            ? `¥${changeAmount.toLocaleString()}`
                            : `不足 ¥${Math.abs(changeAmount).toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => handleConfirmPayment(manualPaymentMethod)}
                    disabled={!canGenerateQr || isConfirmingPayment || !canConfirmManualPayment}
                  >
                    {isConfirmingPayment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        確定中...
                      </>
                    ) : (
                      "手動で会計確定"
                    )}
                  </Button>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>会計完了後は注文履歴に反映されます。</span>
                <Button variant="outline" onClick={() => setStep("select")}>
                  Step Aへ戻る
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
