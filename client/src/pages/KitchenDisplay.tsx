import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft,
  Loader2,
  ChefHat,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Timer,
  Users,
  Bell,
  Volume2,
} from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import { useMemo, useEffect, useRef, useState } from "react";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "served" | "canceled";

type OrderItemWithMenu = {
  id: number;
  orderId: number;
  menuItemId: number;
  quantity: number;
  unitPrice: string;
  modifiers: unknown;
  modifierPrice: string;
  subtotal: string;
  notes: string | null;
  status: string;
  menuItem: {
    id: number;
    name: string;
    prepTimeMinutes: number | null;
    imageUrl: string | null;
  } | null;
};

type KitchenOrder = {
  id: number;
  orderNumber: number;
  status: OrderStatus;
  orderedAt: string;
  notes: string | null;
  maxPrepTime: number;
  items: OrderItemWithMenu[];
  party: {
    id: number;
    ticketNumber: number;
    guestName: string | null;
    tableLabel: string | null;
    partySize: number;
    allergies: string | null;
    notes: string | null;
  } | null;
};

// 経過時間に基づくアラートレベル
type AlertLevel = "normal" | "warning" | "danger" | "critical";

const getAlertLevel = (elapsedMinutes: number, maxPrepTime: number): AlertLevel => {
  const ratio = elapsedMinutes / maxPrepTime;
  if (ratio < 0.8) return "normal";
  if (ratio < 1.0) return "warning";
  if (ratio < 1.5) return "danger";
  return "critical";
};

const alertStyles: Record<AlertLevel, { bg: string; border: string; badge: string }> = {
  normal: {
    bg: "bg-card",
    border: "border-border",
    badge: "bg-muted text-muted-foreground",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-300 dark:border-amber-700",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  danger: {
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-400 dark:border-orange-600",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  critical: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-500 dark:border-red-600",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: "新規", color: "bg-amber-500 text-white" },
  confirmed: { label: "確認済", color: "bg-cyan-500 text-white" },
  preparing: { label: "調理中", color: "bg-blue-500 text-white" },
  ready: { label: "完成", color: "bg-green-500 text-white" },
  served: { label: "提供済", color: "bg-gray-400 text-white" },
  canceled: { label: "キャンセル", color: "bg-red-500 text-white" },
};

// 経過時間を計算（分）
const getElapsedMinutes = (orderedAt: string): number => {
  const now = new Date();
  const ordered = new Date(orderedAt);
  return Math.floor((now.getTime() - ordered.getTime()) / 60000);
};

// 経過時間をフォーマット
const formatElapsedTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}時間${mins}分`;
};

// 同じメニューの集計
type MenuItemAggregate = {
  menuItemId: number;
  name: string;
  totalQuantity: number;
};

const aggregateMenuItems = (orders: KitchenOrder[]): MenuItemAggregate[] => {
  const map = new Map<number, MenuItemAggregate>();
  
  for (const order of orders) {
    for (const item of order.items) {
      if (!item.menuItem) continue;
      const existing = map.get(item.menuItemId);
      if (existing) {
        existing.totalQuantity += item.quantity;
      } else {
        map.set(item.menuItemId, {
          menuItemId: item.menuItemId,
          name: item.menuItem.name,
          totalQuantity: item.quantity,
        });
      }
    }
  }
  
  return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
};

// 注文カードコンポーネント
function OrderCard({
  order,
  onStatusChange,
  isPending,
  nextStatus,
  nextStatusLabel,
}: {
  order: KitchenOrder;
  onStatusChange: (orderId: number, status: OrderStatus) => void;
  isPending: boolean;
  nextStatus: OrderStatus;
  nextStatusLabel: string;
}) {
  const [elapsedMinutes, setElapsedMinutes] = useState(getElapsedMinutes(order.orderedAt));
  const alertLevel = getAlertLevel(elapsedMinutes, order.maxPrepTime);
  const styles = alertStyles[alertLevel];

  // 1分ごとに経過時間を更新
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMinutes(getElapsedMinutes(order.orderedAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [order.orderedAt]);

  return (
    <Card className={`${styles.bg} ${styles.border} border-2 transition-colors`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-2xl font-bold">
                #{order.orderNumber}
              </CardTitle>
              <Badge className={statusConfig[order.status].color}>
                {statusConfig[order.status].label}
              </Badge>
            </div>
            {/* テーブル番号/顧客名 */}
            <div className="flex items-center gap-2 text-sm">
              {order.party?.tableLabel && (
                <Badge variant="outline" className="text-base font-bold px-3 py-1">
                  {order.party.tableLabel}
                </Badge>
              )}
              <span className="text-muted-foreground">
                {order.party?.guestName || "お客様"}
              </span>
              {order.party?.partySize && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-3 h-3" />
                  {order.party.partySize}名
                </span>
              )}
            </div>
          </div>
          {/* 経過時間バッジ */}
          <Badge className={`${styles.badge} text-sm font-mono`}>
            <Timer className="w-3 h-3 mr-1" />
            {formatElapsedTime(elapsedMinutes)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 注文アイテム */}
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-primary min-w-[2rem]">
                  x{item.quantity}
                </span>
                <span className="font-medium">{item.menuItem?.name ?? `商品ID: ${item.menuItemId}`}</span>
              </div>
              {item.notes && (
                <Badge variant="secondary" className="text-xs">
                  {item.notes}
                </Badge>
              )}
            </div>
          ))}
        </div>

        {/* アレルギー・備考 */}
        {(order.party?.allergies || order.notes || order.party?.notes) && (
          <>
            <Separator />
            <div className="space-y-1 text-sm">
              {order.party?.allergies && (
                <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="font-medium">アレルギー: {order.party.allergies}</span>
                </div>
              )}
              {(order.notes || order.party?.notes) && (
                <div className="text-muted-foreground bg-muted/50 rounded p-2">
                  備考: {order.notes || order.party?.notes}
                </div>
              )}
            </div>
          </>
        )}

        {/* アクションボタン */}
        <Button
          className="w-full h-14 text-lg font-bold"
          onClick={() => onStatusChange(order.id, nextStatus)}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : nextStatus === "ready" ? (
            <CheckCircle className="w-5 h-5 mr-2" />
          ) : nextStatus === "served" ? (
            <Bell className="w-5 h-5 mr-2" />
          ) : (
            <ChefHat className="w-5 h-5 mr-2" />
          )}
          {nextStatusLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

// 商品集計サマリーコンポーネント
function ItemSummary({ orders }: { orders: KitchenOrder[] }) {
  const aggregates = useMemo(() => aggregateMenuItems(orders), [orders]);
  
  if (aggregates.length === 0) return null;
  
  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ChefHat className="w-4 h-4" />
          調理待ち合計
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {aggregates.slice(0, 8).map((item) => (
            <Badge key={item.menuItemId} variant="secondary" className="text-sm">
              {item.name} <span className="font-bold ml-1">x{item.totalQuantity}</span>
            </Badge>
          ))}
          {aggregates.length > 8 && (
            <Badge variant="outline" className="text-sm">
              他{aggregates.length - 8}件
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function KitchenDisplay() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = Number.parseInt(storeId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevOrderCountRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: orders, isLoading: ordersLoading, refetch } = trpc.order.list.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0, refetchInterval: 5000 }
  );

  const updateOrderMutation = trpc.order.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  // 新規注文時のサウンド通知
  useEffect(() => {
    if (!orders) return;
    
    const pendingCount = orders.filter(o => o.status === "pending").length;
    
    if (pendingCount > prevOrderCountRef.current && soundEnabled) {
      // 新規注文が増えた
      if (audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
      toast.info("新規注文が入りました", {
        icon: <Bell className="w-5 h-5 text-amber-500" />,
      });
    }
    
    prevOrderCountRef.current = pendingCount;
  }, [orders, soundEnabled]);

  const handleStatusChange = (orderId: number, status: OrderStatus) => {
    updateOrderMutation.mutate({ id: orderId, storeId: storeIdNum, status });
  };

  // 注文を古い順＋優先度でソート
  const sortedOrders = useMemo(() => {
    if (!orders) return [];
    return [...orders].sort((a, b) => {
      // まず orderedAt で古い順にソート
      const timeA = new Date(a.orderedAt).getTime();
      const timeB = new Date(b.orderedAt).getTime();
      return timeA - timeB;
    }) as KitchenOrder[];
  }, [orders]);

  const pendingOrders = useMemo(
    () => sortedOrders.filter(o => o.status === "pending"),
    [sortedOrders]
  );
  const preparingOrders = useMemo(
    () => sortedOrders.filter(o => o.status === "preparing"),
    [sortedOrders]
  );
  const readyOrders = useMemo(
    () => sortedOrders.filter(o => o.status === "ready"),
    [sortedOrders]
  );

  if (authLoading || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>ログインが必要です</CardTitle>
          </CardHeader>
          <CardContent>
            <a href={getLoginUrl()} className="block">
              <Button className="w-full">ログイン</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 通知音用のオーディオ要素 */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRkAQJ7Y2LN0GAA/nNjYtXUXAD+c2di2dBcAP5zZ2LZ0FwA/nNnYtnQXAD+d2de2dRgAQJ3Y17Z2GABAndfXtnYYAECd19e2dhgAQJ3X17Z2GABAndfXtnYYAECd19e2dhgAQJ3X17Z2GABAndfXtnYYAECd19e2dhgAQJ3X17Z2GAA=" type="audio/wav" />
      </audio>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/staff">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <ChefHat className="w-6 h-6 text-primary" />
              <div>
                <h1 className="font-bold text-lg">{store?.name}</h1>
                <p className="text-xs text-muted-foreground">キッチンモニター</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={soundEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              <Volume2 className={`w-4 h-4 mr-2 ${!soundEnabled ? "opacity-50" : ""}`} />
              {soundEnabled ? "通知ON" : "通知OFF"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              更新
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4">
        {ordersLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 新規注文カラム */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-6 h-6 text-amber-500" />
                <h2 className="font-bold text-xl">新規注文</h2>
                <Badge variant="secondary" className="text-lg px-3">
                  {pendingOrders.length}
                </Badge>
              </div>
              
              {/* 商品集計サマリー */}
              <ItemSummary orders={pendingOrders} />
              
              <ScrollArea className="h-[calc(100vh-16rem)]">
                <div className="space-y-4 pr-4">
                  {pendingOrders.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-12 text-center text-muted-foreground">
                        <ChefHat className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        新規注文はありません
                      </CardContent>
                    </Card>
                  ) : (
                    pendingOrders.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={handleStatusChange}
                        isPending={updateOrderMutation.isPending}
                        nextStatus="preparing"
                        nextStatusLabel="調理開始"
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* 調理中カラム */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-6 h-6 text-blue-500" />
                <h2 className="font-bold text-xl">調理中</h2>
                <Badge variant="secondary" className="text-lg px-3">
                  {preparingOrders.length}
                </Badge>
              </div>
              
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <div className="space-y-4 pr-4">
                  {preparingOrders.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-12 text-center text-muted-foreground">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        調理中の注文はありません
                      </CardContent>
                    </Card>
                  ) : (
                    preparingOrders.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={handleStatusChange}
                        isPending={updateOrderMutation.isPending}
                        nextStatus="ready"
                        nextStatusLabel="完成"
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* 完成カラム */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <h2 className="font-bold text-xl">完成</h2>
                <Badge variant="secondary" className="text-lg px-3">
                  {readyOrders.length}
                </Badge>
              </div>
              
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <div className="space-y-4 pr-4">
                  {readyOrders.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="py-12 text-center text-muted-foreground">
                        <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        完成した注文はありません
                      </CardContent>
                    </Card>
                  ) : (
                    readyOrders.map(order => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        onStatusChange={handleStatusChange}
                        isPending={updateOrderMutation.isPending}
                        nextStatus="served"
                        nextStatusLabel="提供完了"
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
