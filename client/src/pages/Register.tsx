import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, CreditCard, Loader2, Receipt, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";

export default function Register() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [tableLabelQuery, setTableLabelQuery] = useState("");
  const [ticketNumberQuery, setTicketNumberQuery] = useState("");
  const checkoutOrders = [
    {
      id: "ORD-102",
      label: "テーブル3",
      items: [
        { name: "和牛ハンバーグ", quantity: 2, price: 1580 },
        { name: "シーザーサラダ", quantity: 1, price: 780 },
      ],
    },
    {
      id: "ORD-103",
      label: "テーブル5",
      items: [
        { name: "本日のパスタ", quantity: 1, price: 1320 },
        { name: "ドリンクセット", quantity: 2, price: 480 },
      ],
    },
  ];
  const subtotal = checkoutOrders.reduce(
    (total, order) =>
      total +
      order.items.reduce((orderTotal, item) => orderTotal + item.price * item.quantity, 0),
    0
  );
  const serviceCharge = Math.round(subtotal * 0.1);
  const grandTotal = subtotal + serviceCharge;

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );
  const { data: parties, isLoading: partiesLoading } = trpc.party.list.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0, refetchInterval: 5000 }
  );

  const filteredParties = useMemo(() => {
    const tableLabelValue = tableLabelQuery.trim().toLowerCase();
    const ticketValue = ticketNumberQuery.trim();
    if (!tableLabelValue && !ticketValue) {
      return parties ?? [];
    }

    return (parties ?? []).filter((party) => {
      const matchesTableLabel = tableLabelValue
        ? (party.tableLabel ?? "").toLowerCase().includes(tableLabelValue)
        : true;
      const matchesTicket = ticketValue
        ? String(party.ticketNumber ?? "").includes(ticketValue)
        : true;
      return matchesTableLabel && matchesTicket;
    });
  }, [parties, tableLabelQuery, ticketNumberQuery]);

  if (authLoading || storeLoading) {
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
          <CardTitle>受付検索</CardTitle>
          <CardDescription>
            テーブルラベルや受付番号で対象の受付を絞り込みます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tableLabelSearch">テーブルラベル</Label>
              <Input
                id="tableLabelSearch"
                placeholder="例: テーブル3"
                value={tableLabelQuery}
                onChange={(event) => setTableLabelQuery(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticketNumberSearch">受付番号</Label>
              <Input
                id="ticketNumberSearch"
                placeholder="例: 12"
                inputMode="numeric"
                value={ticketNumberQuery}
                onChange={(event) => setTicketNumberQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 text-sm">
            {partiesLoading ? (
              <div className="text-muted-foreground">受付情報を読み込み中...</div>
            ) : filteredParties.length === 0 ? (
              <div className="text-muted-foreground">該当する受付がありません。</div>
            ) : (
              filteredParties.map((party) => (
                <div
                  key={party.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">受付番号 {party.ticketNumber}</span>
                      {party.tableLabel ? (
                        <Badge variant="outline">{party.tableLabel}</Badge>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {party.guestName ?? "お客様"} · {party.partySize}名
                    </div>
                  </div>
                  <Badge variant="secondary">{party.status}</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-5 w-5" />
            <CardTitle>会計処理</CardTitle>
          </div>
          <CardDescription>
            会計対象の注文と合計金額を確認し、支払方法を選択してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">会計対象の注文一覧</h2>
                <Badge variant="outline">{checkoutOrders.length}件</Badge>
              </div>
              <div className="space-y-4">
                {checkoutOrders.map((order) => (
                  <div key={order.id} className="rounded-lg border bg-background p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{order.id}</p>
                        <p className="font-medium">{order.label}</p>
                      </div>
                      <Badge variant="secondary">未精算</Badge>
                    </div>
                    <Separator className="my-3" />
                    <div className="space-y-2 text-sm">
                      {order.items.map((item) => (
                        <div key={`${order.id}-${item.name}`} className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            {item.name} × {item.quantity}
                          </span>
                          <span className="font-medium">
                            ¥{(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div className="rounded-lg border bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                  合計金額
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">小計</span>
                    <span className="font-medium">¥{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">サービス料</span>
                    <span className="font-medium">¥{serviceCharge.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>合計</span>
                    <span>¥{grandTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  支払方法
                </div>
                <RadioGroup defaultValue="cash" className="mt-4 space-y-3">
                  <div className="flex items-center space-x-2 rounded-md border p-3">
                    <RadioGroupItem value="cash" id="payment-cash" />
                    <Label htmlFor="payment-cash" className="flex-1">
                      現金
                    </Label>
                    <Badge variant="secondary">推奨</Badge>
                  </div>
                  <div className="flex items-center space-x-2 rounded-md border p-3">
                    <RadioGroupItem value="card" id="payment-card" />
                    <Label htmlFor="payment-card" className="flex-1">
                      クレジットカード
                    </Label>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </div>
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

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                会計確定後は注文履歴に反映されます。
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="outline" asChild>
                  <Link href={`/queue/${storeIdNum}`}>キュー管理へ</Link>
                </Button>
                <Button>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  会計を確定
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
