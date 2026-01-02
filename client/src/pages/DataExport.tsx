import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Receipt,
  Bell,
  ClipboardList,
} from "lucide-react";
import { type ElementType, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

type ExportType = "parties" | "notifications" | "orders" | "orderItems";

type ExportConfig = {
  key: ExportType;
  title: string;
  description: string;
  icon: ElementType;
};

const exportConfigs: ExportConfig[] = [
  {
    key: "parties",
    title: "受付データ",
    description: "受付・順番待ちの履歴をCSVで出力します。",
    icon: ClipboardList,
  },
  {
    key: "notifications",
    title: "通知履歴",
    description: "SMS/LINE/メール通知の履歴をCSVで出力します。",
    icon: Bell,
  },
  {
    key: "orders",
    title: "注文データ",
    description: "注文ヘッダの一覧をCSVで出力します。",
    icon: Receipt,
  },
  {
    key: "orderItems",
    title: "注文明細",
    description: "注文に紐づく明細をCSVで出力します。",
    icon: FileText,
  },
];

export default function DataExport() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0");
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loadingKey, setLoadingKey] = useState<ExportType | null>(null);

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const utils = trpc.useUtils();

  const dateRangeLabel = useMemo(() => {
    if (!startDate && !endDate) return "期間指定なし";
    if (startDate && endDate) return `${startDate} 〜 ${endDate}`;
    if (startDate) return `${startDate} 〜`;
    return `〜 ${endDate}`;
  }, [startDate, endDate]);

  const downloadCsv = (fileName: string, csv: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (type: ExportType) => {
    if (loadingKey) return;
    setLoadingKey(type);
    try {
      const baseParams = {
        storeId: storeIdNum,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        limit: 5000,
      };
      if (type === "parties") {
        const data = await utils.client.dataExport.parties.query(baseParams);
        downloadCsv(data.fileName, data.csv);
        toast.success("受付データCSVをダウンロードしました");
        return;
      }
      if (type === "notifications") {
        const data = await utils.client.dataExport.notifications.query(baseParams);
        downloadCsv(data.fileName, data.csv);
        toast.success("通知履歴CSVをダウンロードしました");
        return;
      }
      if (type === "orders") {
        const data = await utils.client.dataExport.orders.query(baseParams);
        downloadCsv(data.fileName, data.csv);
        toast.success("注文CSVをダウンロードしました");
        return;
      }
      const data = await utils.client.dataExport.orderItems.query(baseParams);
      downloadCsv(data.fileName, data.csv);
      toast.success("注文明細CSVをダウンロードしました");
    } catch (error: any) {
      toast.error(`エラー: ${error.message}`);
    } finally {
      setLoadingKey(null);
    }
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold">{store?.name}</h1>
              <p className="text-xs text-muted-foreground">データエクスポート</p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {dateRangeLabel}
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>エクスポート期間</CardTitle>
            <CardDescription>
              期間を指定しない場合は全期間を対象に出力します。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="export-start">開始日</Label>
              <Input
                id="export-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="export-end">終了日</Label>
              <Input
                id="export-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {exportConfigs.map((config) => (
            <Card key={config.key} className="card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <config.icon className="w-4 h-4" />
                  {config.title}
                </CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => handleExport(config.key)}
                  disabled={loadingKey !== null}
                  className="gap-2"
                >
                  {loadingKey === config.key ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  CSVをダウンロード
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
