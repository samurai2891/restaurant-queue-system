import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Download, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { toast } from "sonner";

type ExportType =
  | "parties"
  | "notifications"
  | "orders"
  | "order_items"
  | "audit_logs"
  | "subscriptions"
  | "daily_analytics";

const exportLabels: Record<ExportType, string> = {
  parties: "顧客受付（ゲスト情報/待ち行列）",
  notifications: "通知履歴（SMS/LINE/Email）",
  orders: "売上/注文ヘッダ",
  order_items: "売上/注文明細",
  audit_logs: "監査ログ",
  subscriptions: "サブスクリプション履歴",
  daily_analytics: "日次集計（分析）",
};

const exportDescriptions: Record<ExportType, string> = {
  parties: "受付番号・連絡先・状態などの受付情報をCSVで出力します。",
  notifications: "通知の送信履歴とステータスをCSVで出力します。",
  orders: "注文の概要（合計金額や状態）をCSVで出力します。",
  order_items: "注文明細と数量・単価をCSVで出力します。",
  audit_logs: "操作履歴（監査ログ）をCSVで出力します。",
  subscriptions: "サブスクリプションの履歴をCSVで出力します。",
  daily_analytics: "日次集計データをCSVで出力します。",
};

export default function DataExport() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0", 10);
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [downloading, setDownloading] = useState<ExportType | null>(null);

  const { data: store } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const exportItems = useMemo<ExportType[]>(
    () => [
      "parties",
      "notifications",
      "orders",
      "order_items",
      "audit_logs",
      "subscriptions",
      "daily_analytics",
    ],
    []
  );

  const handleDownload = async (type: ExportType) => {
    if (!storeIdNum) return;
    setDownloading(type);
    try {
      const result = await utils.client.dataExport.export.query({
        storeId: storeIdNum,
        type,
      });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${exportLabels[type]} をダウンロードしました`);
    } catch (error) {
      console.error(error);
      toast.error(`${exportLabels[type]} のダウンロードに失敗しました`);
    } finally {
      setDownloading(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-6 p-6 max-w-md w-full">
          <h1 className="text-xl font-semibold tracking-tight text-center">Sign in to continue</h1>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            データダウンロードには認証が必要です。ログインしてください。
          </p>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">データダウンロード</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {store ? `${store.name} の各データをCSVで出力できます。` : "各データをCSVで出力できます。"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-4 w-4" />
          CSV形式で出力
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {exportItems.map((type) => (
          <Card key={type} className="flex h-full flex-col">
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">{exportLabels[type]}</CardTitle>
              <CardDescription>{exportDescriptions[type]}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button
                className="w-full"
                onClick={() => handleDownload(type)}
                disabled={downloading !== null}
              >
                <Download className="mr-2 h-4 w-4" />
                {downloading === type ? "ダウンロード中..." : "CSVをダウンロード"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
