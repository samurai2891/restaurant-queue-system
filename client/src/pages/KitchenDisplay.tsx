import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft,
  Loader2,
  ChefHat,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "served" | "canceled";

const statusConfig: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: "新規", color: "bg-amber-100 text-amber-800" },
  confirmed: { label: "確認済", color: "bg-cyan-100 text-cyan-800" },
  preparing: { label: "調理中", color: "bg-blue-100 text-blue-800" },
  ready: { label: "完成", color: "bg-green-100 text-green-800" },
  served: { label: "提供済", color: "bg-gray-100 text-gray-600" },
  canceled: { label: "キャンセル", color: "bg-red-100 text-red-800" },
};

export default function KitchenDisplay() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0");
  const { loading: authLoading, isAuthenticated } = useAuth();

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

  const handleStatusChange = (orderId: number, status: OrderStatus) => {
    updateOrderMutation.mutate({ id: orderId, storeId: storeIdNum, status });
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

  const kitchenOrders = orders?.filter(o => o.routeToKitchen === true) || [];
  const pendingOrders = kitchenOrders.filter(o => o.status === "pending");
  const preparingOrders = kitchenOrders.filter(o => o.status === "preparing");
  const readyOrders = kitchenOrders.filter(o => o.status === "ready");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-primary" />
              <div>
                <h1 className="font-bold">{store?.name}</h1>
                <p className="text-xs text-muted-foreground">キッチンディスプレイ</p>
              </div>
            </div>
          </div>
          
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            更新
          </Button>
        </div>
      </header>

      <main className="container py-6">
        {ordersLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pending Orders */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h2 className="font-bold text-lg">新規注文</h2>
                <Badge variant="secondary">{pendingOrders.length}</Badge>
              </div>
              <div className="space-y-4">
                {pendingOrders.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      新規注文はありません
                    </CardContent>
                  </Card>
                ) : (
                  pendingOrders.map(order => (
                    <Card key={order.id} className="border-amber-200 bg-amber-50/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            #{order.orderNumber}
                          </CardTitle>
                          <Badge className={statusConfig.pending.color}>
                            {statusConfig.pending.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.party?.guestName || 'お客様'}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 mb-4">
                          {order.items?.map((item, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>商品ID: {item.menuItemId} × {item.quantity}</span>
                            </div>
                          ))}
                        </div>
                        {order.notes && (
                          <p className="text-sm text-muted-foreground bg-white/50 rounded p-2 mb-4">
                            備考: {order.notes}
                          </p>
                        )}
                        <Button 
                          className="w-full"
                          onClick={() => handleStatusChange(order.id, "preparing")}
                        >
                          調理開始
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Preparing Orders */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-blue-500" />
                <h2 className="font-bold text-lg">調理中</h2>
                <Badge variant="secondary">{preparingOrders.length}</Badge>
              </div>
              <div className="space-y-4">
                {preparingOrders.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      調理中の注文はありません
                    </CardContent>
                  </Card>
                ) : (
                  preparingOrders.map(order => (
                    <Card key={order.id} className="border-blue-200 bg-blue-50/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            #{order.orderNumber}
                          </CardTitle>
                          <Badge className={statusConfig.preparing.color}>
                            {statusConfig.preparing.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.party?.guestName || 'お客様'}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 mb-4">
                          {order.items?.map((item, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>商品ID: {item.menuItemId} × {item.quantity}</span>
                            </div>
                          ))}
                        </div>
                        <Button 
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() => handleStatusChange(order.id, "ready")}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          完成
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Ready Orders */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <h2 className="font-bold text-lg">完成</h2>
                <Badge variant="secondary">{readyOrders.length}</Badge>
              </div>
              <div className="space-y-4">
                {readyOrders.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      完成した注文はありません
                    </CardContent>
                  </Card>
                ) : (
                  readyOrders.map(order => (
                    <Card key={order.id} className="border-green-200 bg-green-50/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            #{order.orderNumber}
                          </CardTitle>
                          <Badge className={statusConfig.ready.color}>
                            {statusConfig.ready.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {order.party?.guestName || 'お客様'}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 mb-4">
                          {order.items?.map((item, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>商品ID: {item.menuItemId} × {item.quantity}</span>
                            </div>
                          ))}
                        </div>
                        <Button 
                          variant="outline"
                          className="w-full"
                          onClick={() => handleStatusChange(order.id, "served")}
                        >
                          提供完了
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
