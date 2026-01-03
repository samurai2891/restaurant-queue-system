import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  ChefHat,
  CreditCard,
  Download,
  Loader2,
  LogOut,
  Plus,
  Settings,
  Store,
  Utensils,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreDescription, setNewStoreDescription] = useState("");

  const { data: stores, isLoading: storesLoading, refetch } = trpc.store.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const createStoreMutation = trpc.store.create.useMutation({
    onSuccess: () => {
      toast.success("店舗を作成しました");
      setIsCreateDialogOpen(false);
      setNewStoreName("");
      setNewStoreDescription("");
      refetch();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const handleCreateStore = () => {
    if (!newStoreName.trim()) {
      toast.error("店舗名を入力してください");
      return;
    }
    createStoreMutation.mutate({
      name: newStoreName,
      description: newStoreDescription || undefined,
    });
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (authLoading) {
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
            <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-white" />
            </div>
            <CardTitle>ログインが必要です</CardTitle>
            <CardDescription>
              ダッシュボードにアクセスするにはログインしてください
            </CardDescription>
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
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Store className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">QueuePro</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.name || user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">ダッシュボード</h1>
          <p className="text-muted-foreground">
            店舗を選択して管理を開始してください
          </p>
        </div>

        {/* Stores Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Create New Store Card */}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Card className="border-dashed cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors">
                <CardContent className="flex flex-col items-center justify-center h-48">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Plus className="w-6 h-6 text-primary" />
                  </div>
                  <p className="font-medium">新しい店舗を追加</p>
                  <p className="text-sm text-muted-foreground">クリックして作成</p>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新しい店舗を作成</DialogTitle>
                <DialogDescription>
                  店舗の基本情報を入力してください
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="storeName">店舗名 *</Label>
                  <Input
                    id="storeName"
                    placeholder="例: カフェ○○ 渋谷店"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeDescription">説明</Label>
                  <Textarea
                    id="storeDescription"
                    placeholder="店舗の説明（任意）"
                    value={newStoreDescription}
                    onChange={(e) => setNewStoreDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button 
                  onClick={handleCreateStore}
                  disabled={createStoreMutation.isPending}
                >
                  {createStoreMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  作成
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Store Cards */}
          {storesLoading ? (
            <>
              {[1, 2].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-1/2 mb-2" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            stores?.map((store) => (
              <Card key={store.id} className="card-hover overflow-hidden">
                <CardHeader className="border-b bg-muted/20">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{store.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {store.description || "説明なし"}
                      </CardDescription>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        store.isReceptionPaused
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {store.isReceptionPaused ? "受付停止中" : "受付中"}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div className="rounded-lg border bg-background/60 p-3 text-xs text-muted-foreground">
                    店舗ごとの主要導線をPOSカードでまとめています。
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Link href={`/cashier/${store.id}`}>
                      <Button className="w-full justify-start gap-2">
                        <CreditCard className="w-4 h-4" />
                        レジ
                      </Button>
                    </Link>
                    <Link href={`/queue/${store.id}`}>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Users className="w-4 h-4" />
                        キュー管理
                      </Button>
                    </Link>
                    <Link href={`/kitchen/${store.id}`}>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <ChefHat className="w-4 h-4" />
                        キッチン
                      </Button>
                    </Link>
                    <Link href={`/menu/${store.id}`}>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Utensils className="w-4 h-4" />
                        メニュー管理
                      </Button>
                    </Link>
                    <Link href={`/analytics/${store.id}`}>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <BarChart3 className="w-4 h-4" />
                        分析
                      </Button>
                    </Link>
                    <Link href={`/settings/${store.id}`}>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Settings className="w-4 h-4" />
                        設定
                      </Button>
                    </Link>
                    <Link href={`/export/${store.id}`} className="col-span-2">
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <Download className="w-4 h-4" />
                        データ出力
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Empty State */}
        {!storesLoading && stores?.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">店舗がありません</h3>
            <p className="text-muted-foreground mb-4">
              「新しい店舗を追加」から最初の店舗を作成してください
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
