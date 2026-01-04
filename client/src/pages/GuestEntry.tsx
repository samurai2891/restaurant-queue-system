import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, QrCode, UtensilsCrossed } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";

export default function GuestEntry() {
  const [storeId, setStoreId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [, setLocation] = useLocation();

  const trimmedStoreId = storeId.trim();
  const trimmedAccessToken = accessToken.trim();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="text-lg font-semibold">
            QueuePro
          </Link>
          <Link href="/staff" className="text-sm text-muted-foreground hover:text-foreground">
            スタッフ入口へ
          </Link>
        </div>
      </header>

      <main className="container py-10">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold">ゲスト専用入口</h1>
            <p className="text-muted-foreground">
              店頭のQRコードやスタッフから共有されたリンクをお持ちの方はこちらから進んでください。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <QrCode className="h-5 w-5" />
                  <CardTitle>受付を開始</CardTitle>
                </div>
                <CardDescription>店舗IDがわかる場合は受付フォームへ進みます。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storeId">店舗ID</Label>
                  <Input
                    id="storeId"
                    value={storeId}
                    onChange={(event) => setStoreId(event.target.value)}
                    placeholder="例: 1234"
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!trimmedStoreId}
                  onClick={() => setLocation(`/guest/register/${trimmedStoreId}`)}
                >
                  受付フォームへ
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <UtensilsCrossed className="h-5 w-5" />
                  <CardTitle>順番・メニュー確認</CardTitle>
                </div>
                <CardDescription>
                  スタッフから案内されたアクセスコードを入力してください。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accessToken">アクセスコード</Label>
                  <Input
                    id="accessToken"
                    value={accessToken}
                    onChange={(event) => setAccessToken(event.target.value)}
                    placeholder="例: abcd-1234"
                  />
                </div>
                <div className="grid gap-3">
                  <Button
                    variant="outline"
                    disabled={!trimmedAccessToken}
                    onClick={() => setLocation(`/guest/status/${trimmedAccessToken}`)}
                  >
                    順番状況を見る
                  </Button>
                  <Button
                    disabled={!trimmedAccessToken}
                    onClick={() => setLocation(`/guest/menu/${trimmedAccessToken}`)}
                  >
                    メニューを見る
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
