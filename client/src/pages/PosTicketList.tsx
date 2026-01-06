import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";

type PosTab = "OPEN" | "MEMO_ONLY" | "PAYMENT_LOCKED" | "PAID";

const tabLabels: Record<PosTab, string> = {
  OPEN: "Open",
  MEMO_ONLY: "Memo Only",
  PAYMENT_LOCKED: "Payment In Progress",
  PAID: "Paid",
};

const statusBadgeVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  OPEN: "secondary",
  ITEMIZED: "secondary",
  MEMO_ONLY: "outline",
  PAYMENT_LOCKED: "default",
  PAID: "secondary",
  VOID: "destructive",
};

export default function PosTicketList() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = Number.parseInt(storeId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const [tab, setTab] = useState<PosTab>("OPEN");
  const [search, setSearch] = useState("");

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: tickets, isLoading: ticketsLoading, refetch } = trpc.ticket.list.useQuery(
    {
      storeId: storeIdNum,
      posStatus: tab === "OPEN" ? undefined : tab,
      search: search.trim() || undefined,
    },
    { enabled: isAuthenticated && storeIdNum > 0, refetchInterval: 5000 }
  );

  const createTicketMutation = trpc.ticket.create.useMutation({
    onSuccess: (created) => {
      toast.success(`伝票 #${created.ticketNumber} を作成しました`);
      setLocation(`/pos/${storeIdNum}/tickets/${created.id}/edit`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const counts = useMemo(() => {
    const list = tickets ?? [];
    const total = list.length;
    const locked = list.filter((t) => t.posStatus === "PAYMENT_LOCKED").length;
    const memo = list.filter((t) => t.posStatus === "MEMO_ONLY").length;
    return { total, locked, memo };
  }, [tickets]);

  const visibleTickets = useMemo(() => {
    const list = tickets ?? [];
    if (tab === "OPEN") {
      return list.filter((t) => t.posStatus === "OPEN" || t.posStatus === "ITEMIZED");
    }
    return list;
  }, [tickets, tab]);

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

  const posEnabled = Boolean(store.enablePosV2UI);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar (Airレジ風) */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href="/staff">
              <Button variant="ghost" size="icon" aria-label="戻る">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="leading-tight">
              <div className="font-semibold">POS 伝票一覧</div>
              <div className="text-xs text-muted-foreground">{store.name}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={ticketsLoading}
            >
              再読込
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {!posEnabled && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">この店舗ではPOS新UIが無効です</CardTitle>
              <CardDescription>
                管理者が「店舗設定」で `enablePosV2UI` を有効にすると利用できます。
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="伝票番号 / テーブル / 顧客名で検索"
                className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 w-72 max-w-full"
              />
            </div>
            <Badge variant="outline">{counts.total}件</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => createTicketMutation.mutate({ storeId: storeIdNum, kind: "DINE_IN" })}
              disabled={!posEnabled || createTicketMutation.isPending}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              店内伝票
            </Button>
            <Button
              variant="outline"
              onClick={() => createTicketMutation.mutate({ storeId: storeIdNum, kind: "COUNTER_SALE" })}
              disabled={!posEnabled || createTicketMutation.isPending}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              店頭伝票（Quick Sale）
            </Button>
            <Button
              variant="outline"
              onClick={() => createTicketMutation.mutate({ storeId: storeIdNum, kind: "MEMO_ONLY" })}
              disabled={!posEnabled || createTicketMutation.isPending}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              メモ伝票
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as PosTab)}>
          <TabsList>
            {(["OPEN", "MEMO_ONLY", "PAYMENT_LOCKED", "PAID"] as const).map((key) => (
              <TabsTrigger key={key} value={key}>
                {tabLabels[key]}
              </TabsTrigger>
            ))}
          </TabsList>

          {(["OPEN", "MEMO_ONLY", "PAYMENT_LOCKED", "PAID"] as const).map((key) => (
            <TabsContent key={key} value={key} className="mt-4">
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
                  {visibleTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      className="text-left"
                      onClick={() => setLocation(`/pos/${storeIdNum}/tickets/${ticket.id}/edit`)}
                    >
                      <Card className="hover:shadow-sm transition-shadow">
                        <CardContent className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant={statusBadgeVariant[ticket.posStatus] ?? "secondary"}>
                              {ticket.posStatus}
                            </Badge>
                            <div className="font-semibold">
                              伝票 #{ticket.ticketNumber}
                              {ticket.tableLabel ? ` · ${ticket.tableLabel}` : ""}
                            </div>
                            {ticket.partyKind !== "DINE_IN" && (
                              <Badge variant="outline">{ticket.partyKind}</Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-6 text-sm text-muted-foreground">
                            <div>
                              {Number(ticket.unpaidItemsCount ?? 0)}点
                            </div>
                            <div className="font-semibold text-foreground">
                              ¥{Number(ticket.unpaidTotalAmount ?? 0).toLocaleString()}
                            </div>
                            <div className="hidden md:block">
                              更新: {ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleTimeString() : "-"}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}


