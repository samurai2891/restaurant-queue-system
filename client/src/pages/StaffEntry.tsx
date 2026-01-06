import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoginUrl } from "@/const";
import { ChefHat, ClipboardList, CreditCard, LogIn, Smartphone, Receipt, Store } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function StaffEntry() {
  const { isAuthenticated, loading, user } = useAuth();
  const [storeId, setStoreId] = useState("");
  const [, setLocation] = useLocation();

  const trimmedStoreId = storeId.trim();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-lg font-semibold">
            QueuePro
          </Link>
          <Link href="/guest" className="text-sm text-muted-foreground hover:text-foreground">
            ゲスト入口へ
          </Link>
        </div>
      </header>

      <main className="container py-10">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold">スタッフ入口</h1>
            <p className="text-muted-foreground">
              店舗スタッフ向けの運用画面です。ログイン後、担当する店舗IDでアクセスしてください。
            </p>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary">
                <LogIn className="h-5 w-5" />
                <CardTitle>スタッフログイン</CardTitle>
              </div>
              <CardDescription>認証済みの場合はそのまま操作メニューに進めます。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                {loading
                  ? "認証情報を確認中..."
                  : isAuthenticated
                  ? `${user?.name || user?.email || "ログイン済み"}でログイン中`
                  : "ログインが必要です"}
              </div>
              {!isAuthenticated && !loading && (
                <a href={getLoginUrl()}>
                  <Button className="gap-2">
                    ログイン
                    <LogIn className="h-4 w-4" />
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <ClipboardList className="h-5 w-5" />
                  <CardTitle>現場オペレーション</CardTitle>
                </div>
                <CardDescription>
                  受付・キュー管理などのスタッフ画面に移動します。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="staffStoreId">店舗ID</Label>
                  <Input
                    id="staffStoreId"
                    value={storeId}
                    onChange={(event) => setStoreId(event.target.value)}
                    placeholder="例: 1234"
                  />
                </div>
                <div className="grid gap-2">
                  <Button
                    className="justify-start"
                    variant="default"
                    disabled={!trimmedStoreId}
                    onClick={() => setLocation(`/pos/${trimmedStoreId}/tickets`)}
                  >
                    <Receipt className="mr-2 h-4 w-4" />
                    POS（伝票一覧）
                  </Button>
                  <Button
                    className="justify-start"
                    variant="outline"
                    disabled={!trimmedStoreId}
                    onClick={() => setLocation(`/handheld/${trimmedStoreId}`)}
                  >
                    <Smartphone className="mr-2 h-4 w-4" />
                    ハンディ注文
                  </Button>
                  <Button
                    className="justify-start"
                    disabled={!trimmedStoreId}
                    onClick={() => setLocation(`/queue/${trimmedStoreId}`)}
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    キュー管理
                  </Button>
                  <Button
                    className="justify-start"
                    variant="outline"
                    disabled={!trimmedStoreId}
                    onClick={() => setLocation(`/register/${trimmedStoreId}`)}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    レジ
                  </Button>
                  <Button
                    className="justify-start"
                    variant="outline"
                    disabled={!trimmedStoreId}
                    onClick={() => setLocation(`/kitchen/${trimmedStoreId}`)}
                  >
                    <ChefHat className="mr-2 h-4 w-4" />
                    キッチン
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <Store className="h-5 w-5" />
                  <CardTitle>管理者ポータル</CardTitle>
                </div>
                <CardDescription>
                  店舗設定や分析など管理者向け機能へ移動します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/admin">
                  <Button className="w-full">管理者ダッシュボードへ</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
