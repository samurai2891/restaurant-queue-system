import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { 
  Store, 
  Clock, 
  Users,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChefHat
} from "lucide-react";
import { useParams, Link } from "wouter";
import { useEffect } from "react";

type PartyStatus = "waiting" | "notified" | "arrived" | "seated" | "canceled" | "noshow";

const statusConfig: Record<PartyStatus, { 
  label: string; 
  description: string;
  color: string; 
  icon: React.ElementType;
  bgColor: string;
}> = {
  waiting: { 
    label: "待機中", 
    description: "順番をお待ちください",
    color: "text-amber-600", 
    icon: Clock,
    bgColor: "bg-amber-50"
  },
  notified: { 
    label: "お呼び出し中", 
    description: "店頭までお越しください",
    color: "text-blue-600", 
    icon: Bell,
    bgColor: "bg-blue-50"
  },
  arrived: { 
    label: "到着確認済み", 
    description: "まもなくご案内いたします",
    color: "text-indigo-600", 
    icon: CheckCircle,
    bgColor: "bg-indigo-50"
  },
  seated: { 
    label: "ご案内済み", 
    description: "ご来店ありがとうございました",
    color: "text-green-600", 
    icon: CheckCircle,
    bgColor: "bg-green-50"
  },
  canceled: { 
    label: "キャンセル", 
    description: "受付がキャンセルされました",
    color: "text-gray-600", 
    icon: XCircle,
    bgColor: "bg-gray-50"
  },
  noshow: { 
    label: "ご来店なし", 
    description: "呼び出しに応答がありませんでした",
    color: "text-red-600", 
    icon: AlertCircle,
    bgColor: "bg-red-50"
  },
};

export default function GuestStatus() {
  const { accessToken } = useParams<{ accessToken: string }>();

  const { data: status, isLoading, error, refetch } = trpc.party.guestStatus.useQuery(
    { accessToken: accessToken || "" },
    { 
      enabled: !!accessToken,
      refetchInterval: 10000 // 10秒ごとに自動更新
    }
  );

  // 通知音を鳴らす（呼び出し時）
  useEffect(() => {
    if (status?.status === "notified") {
      // ブラウザ通知を試みる
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("順番が来ました！", {
          body: "店頭までお越しください",
          icon: "/favicon.ico"
        });
      }
    }
  }, [status?.status]);

  // 通知許可をリクエスト
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-medium">情報が見つかりません</p>
            <p className="text-sm text-muted-foreground mt-2">
              URLが正しいかご確認ください
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStatus = statusConfig[status.status as PartyStatus] || statusConfig.waiting;
  const StatusIcon = currentStatus.icon;
  const isActive = status.status === "waiting" || status.status === "notified" || status.status === "arrived";
  const canOrder = status.canOrder && isActive;

  return (
    <div className={`min-h-screen ${currentStatus.bgColor} transition-colors duration-500`}>
      <div className="max-w-md mx-auto p-4 pt-8">
        {/* Store Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center mx-auto mb-3">
            <Store className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold">{status.storeName}</h1>
        </div>

        {/* Status Card */}
        <Card className={`mb-6 ${status.status === "notified" ? 'animate-pulse-gentle ring-2 ring-blue-400' : ''}`}>
          <CardHeader className="text-center pb-2">
            <div className={`w-16 h-16 rounded-full ${currentStatus.bgColor} flex items-center justify-center mx-auto mb-4`}>
              <StatusIcon className={`w-8 h-8 ${currentStatus.color}`} />
            </div>
            <Badge className={`${currentStatus.color} ${currentStatus.bgColor} border-0 mb-2`}>
              {currentStatus.label}
            </Badge>
            <CardDescription className="text-base">
              {currentStatus.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="bg-muted/50 rounded-2xl p-6 mb-4">
              <p className="text-sm text-muted-foreground mb-1">受付番号</p>
              <p className="queue-number text-primary">{status.ticketNumber}</p>
            </div>

            {isActive && (
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">現在の順番</p>
                  <p className="text-2xl font-bold">{status.position}番目</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-sm text-muted-foreground">推定待ち時間</p>
                  <p className="text-2xl font-bold">{status.estimatedWaitMinutes}分</p>
                </div>
              </div>
            )}

            {status.status === "notified" && (
              <div className="mt-4 p-4 bg-blue-100 rounded-lg">
                <Bell className="w-6 h-6 text-blue-600 mx-auto mb-2 animate-bounce" />
                <p className="font-medium text-blue-800">
                  お席の準備ができました！
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  店頭スタッフにお声がけください
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Party Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">受付情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  人数
                </span>
                <span className="font-medium">{status.partySize}名</span>
              </div>
              {status.guestName && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">お名前</span>
                  <span className="font-medium">{status.guestName}</span>
                </div>
              )}
              {status.preferredSeatType && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">希望席種</span>
                  <span className="font-medium">{status.preferredSeatType}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pre-order CTA */}
        {canOrder && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ChefHat className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">待ち時間中に注文できます</p>
                  <p className="text-sm text-muted-foreground">
                    事前注文で着席後すぐにお料理を楽しめます
                  </p>
                </div>
              </div>
              <Link href={`/guest/menu/${accessToken}`}>
                <Button className="w-full mt-4">
                  メニューを見る
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Refresh Button */}
        {isActive && (
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => refetch()}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            更新する
          </Button>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          10秒ごとに自動更新されます
        </p>
      </div>
    </div>
  );
}
