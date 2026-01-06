import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, Loader2, Receipt, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function PosPayment() {
  const { storeId, ticketId } = useParams<{ storeId: string; ticketId: string }>();
  const storeIdNum = Number.parseInt(storeId || "0", 10);
  const ticketIdNum = Number.parseInt(ticketId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const [cashReceived, setCashReceived] = useState("");
  const [manualMethod, setManualMethod] = useState("card");
  const [completed, setCompleted] = useState<null | { changeAmount?: number; totalAmount: number }>(null);

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: ticketData, isLoading: ticketLoading, refetch } = trpc.ticket.get.useQuery(
    { storeId: storeIdNum, ticketId: ticketIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 && ticketIdNum > 0, refetchInterval: 5000 }
  );

  const lockMutation = trpc.ticket.lockForPayment.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error(e.message),
  });

  const confirmCashMutation = trpc.payment.confirmCash.useMutation({
    onSuccess: (res) => {
      toast.success("会計を確定しました");
      setCompleted({ totalAmount: res.totalAmount, changeAmount: res.changeAmount });
    },
    onError: (e) => toast.error(e.message),
  });

  const confirmManualMutation = trpc.payment.confirmManual.useMutation({
    onSuccess: (res) => {
      toast.success("会計を確定しました");
      setCompleted({ totalAmount: res.totalAmount });
    },
    onError: (e) => toast.error(e.message),
  });

  const ticket = ticketData?.ticket;
  const totalAmount = ticketData?.totals.totalAmount ?? 0;

  const cashReceivedNumber = cashReceived ? Number(cashReceived) : 0;
  const changeAmount = cashReceivedNumber - totalAmount;
  const canConfirmCash = cashReceivedNumber >= totalAmount && totalAmount > 0;

  const isSubmitting = lockMutation.isPending || confirmCashMutation.isPending || confirmManualMutation.isPending;
  const posEnabled = Boolean(store?.enablePosV2UI);

  const statusLabel = useMemo(() => {
    if (!ticket) return "-";
    return ticket.posStatus;
  }, [ticket]);

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
            <CardDescription>店舗設定で有効にしてください。</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/pos/${storeIdNum}/tickets`}>
              <Button className="w-full">伝票一覧へ</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Link href={`/pos/${storeIdNum}/tickets`}>
                <Button variant="ghost" size="icon" aria-label="伝票一覧へ">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="font-semibold">会計完了</div>
            </div>
            <Badge variant="outline">伝票 #{ticket.ticketNumber}</Badge>
          </div>
        </header>

        <main className="p-6 flex items-center justify-center">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-green-700">
                <CheckCircle2 className="w-6 h-6" />
                お会計を完了しました
              </CardTitle>
              <CardDescription>レシート/領収書は後続で対応します</CardDescription>
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

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button variant="outline" className="gap-2" disabled>
                  <Receipt className="w-4 h-4" />
                  レシート再印刷（後続）
                </Button>
                <Button
                  className="gap-2"
                  onClick={() => setLocation(`/pos/${storeIdNum}/tickets`)}
                >
                  伝票一覧へ
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const needsLock = ticket.posStatus !== "PAYMENT_LOCKED";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href={`/pos/${storeIdNum}/tickets/${ticketIdNum}/edit`}>
              <Button variant="ghost" size="icon" aria-label="戻る">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="leading-tight">
              <div className="font-semibold">支払い</div>
              <div className="text-xs text-muted-foreground">伝票 #{ticket.ticketNumber}</div>
            </div>
          </div>
          <Badge variant="outline">{statusLabel}</Badge>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto space-y-4">
        {needsLock && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">会計開始（ロック）</CardTitle>
              <CardDescription>会計中は他端末からの編集/追加を制限します。</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => lockMutation.mutate({ storeId: storeIdNum, ticketId: ticketIdNum })}
                disabled={isSubmitting}
              >
                会計を開始する
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
                <span className="text-xl font-bold text-primary">¥{totalAmount.toLocaleString()}</span>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground">
                ロック中のみ確定できます。ロックされていない場合は上のボタンで開始してください。
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
                  disabled={isSubmitting || needsLock}
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
                onClick={() => confirmCashMutation.mutate({ storeId: storeIdNum, ticketId: ticketIdNum, cashReceived: cashReceivedNumber })}
                disabled={!canConfirmCash || isSubmitting || needsLock}
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
                <RadioGroupItem value="card" id="pos-manual-card" />
                <span className="text-sm font-medium">カード</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border p-3">
                <RadioGroupItem value="qr" id="pos-manual-qr" />
                <span className="text-sm font-medium">QR決済</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border p-3">
                <RadioGroupItem value="external" id="pos-manual-external" />
                <span className="text-sm font-medium">外部POS（手動確定）</span>
              </label>
            </RadioGroup>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => confirmManualMutation.mutate({ storeId: storeIdNum, ticketId: ticketIdNum, paymentMethod: manualMethod })}
              disabled={isSubmitting || needsLock || totalAmount <= 0}
            >
              手動で確定
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


