import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { 
  Store, 
  ArrowLeft,
  Loader2,
  Settings,
  Clock,
  Users,
  Bell,
  Plus,
  Trash2,
  Save
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

export default function StoreSettings() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0");
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  
  const [isAddSeatTypeOpen, setIsAddSeatTypeOpen] = useState(false);
  const [newSeatTypeName, setNewSeatTypeName] = useState("");
  const [newSeatTypeMin, setNewSeatTypeMin] = useState("1");
  const [newSeatTypeMax, setNewSeatTypeMax] = useState("4");
  const [newSeatTypeTotal, setNewSeatTypeTotal] = useState("10");

  const { data: store, isLoading: storeLoading, refetch: refetchStore } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: seatTypes, refetch: refetchSeatTypes } = trpc.seatType.list.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: templates, refetch: refetchTemplates } = trpc.notification.templates.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  // Form state
  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeEmail, setStoreEmail] = useState("");
  const [orderReleaseRank, setOrderReleaseRank] = useState("5");
  const [orderReleaseMinutes, setOrderReleaseMinutes] = useState("15");
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [lineChannelAccessToken, setLineChannelAccessToken] = useState("");
  const [lineChannelSecret, setLineChannelSecret] = useState("");
  const [autoNotifyRank, setAutoNotifyRank] = useState("0");
  const [autoNotifyMinutes, setAutoNotifyMinutes] = useState("0");

  useEffect(() => {
    if (store) {
      setStoreName(store.name || "");
      setStoreDescription(store.description || "");
      setStoreAddress(store.address || "");
      setStorePhone(store.phone || "");
      setStoreEmail(store.email || "");
      setOrderReleaseRank(String(store.orderReleaseRank || 5));
      setOrderReleaseMinutes(String(store.orderReleaseMinutes || 15));
      setSmsEnabled(store.smsEnabled ?? false);
      setLineChannelAccessToken(store.lineChannelAccessToken || "");
      setLineChannelSecret(store.lineChannelSecret || "");
      setAutoNotifyRank(String(store.autoNotifyRank ?? 0));
      setAutoNotifyMinutes(String(store.autoNotifyMinutes ?? 0));
    }
  }, [store]);

  const updateStoreMutation = trpc.store.update.useMutation({
    onSuccess: () => {
      toast.success("店舗情報を更新しました");
      refetchStore();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const createSeatTypeMutation = trpc.seatType.create.useMutation({
    onSuccess: () => {
      toast.success("席種を追加しました");
      setIsAddSeatTypeOpen(false);
      setNewSeatTypeName("");
      setNewSeatTypeMin("1");
      setNewSeatTypeMax("4");
      setNewSeatTypeTotal("10");
      refetchSeatTypes();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const updateSeatTypeMutation = trpc.seatType.update.useMutation({
    onSuccess: () => {
      toast.success("席種を更新しました");
      refetchSeatTypes();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const handleSaveStore = () => {
    updateStoreMutation.mutate({
      id: storeIdNum,
      name: storeName,
      description: storeDescription || undefined,
      address: storeAddress || undefined,
      phone: storePhone || undefined,
      email: storeEmail || undefined,
      orderReleaseRank: parseInt(orderReleaseRank),
      orderReleaseMinutes: parseInt(orderReleaseMinutes),
    });
  };

  const handleSaveNotifications = () => {
    updateStoreMutation.mutate({
      id: storeIdNum,
      smsEnabled,
      lineChannelAccessToken: lineChannelAccessToken || undefined,
      lineChannelSecret: lineChannelSecret || undefined,
      autoNotifyRank: parseInt(autoNotifyRank),
      autoNotifyMinutes: parseInt(autoNotifyMinutes),
    });
  };

  const handleAddSeatType = () => {
    if (!newSeatTypeName.trim()) {
      toast.error("席種名を入力してください");
      return;
    }
    createSeatTypeMutation.mutate({
      storeId: storeIdNum,
      name: newSeatTypeName,
      minPartySize: parseInt(newSeatTypeMin),
      maxPartySize: parseInt(newSeatTypeMax),
      totalSeats: parseInt(newSeatTypeTotal),
    });
  };

  const handleDeleteSeatType = (id: number) => {
    updateSeatTypeMutation.mutate({
      id,
      storeId: storeIdNum,
      isActive: false,
    });
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
      {/* Header */}
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
              <p className="text-xs text-muted-foreground">店舗設定</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Tabs defaultValue="general">
          <TabsList className="mb-6">
            <TabsTrigger value="general" className="gap-2">
              <Settings className="w-4 h-4" />
              基本情報
            </TabsTrigger>
            <TabsTrigger value="seats" className="gap-2">
              <Users className="w-4 h-4" />
              席種設定
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              通知設定
            </TabsTrigger>
            <TabsTrigger value="order" className="gap-2">
              <Clock className="w-4 h-4" />
              注文ルール
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>基本情報</CardTitle>
                <CardDescription>店舗の基本情報を設定します</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>店舗名 *</Label>
                  <Input
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>説明</Label>
                  <Textarea
                    value={storeDescription}
                    onChange={(e) => setStoreDescription(e.target.value)}
                    placeholder="店舗の説明"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>住所</Label>
                    <Input
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      placeholder="東京都渋谷区..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>電話番号</Label>
                    <Input
                      value={storePhone}
                      onChange={(e) => setStorePhone(e.target.value)}
                      placeholder="03-1234-5678"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>メールアドレス</Label>
                  <Input
                    type="email"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    placeholder="store@example.com"
                  />
                </div>
                <Button onClick={handleSaveStore} disabled={updateStoreMutation.isPending}>
                  {updateStoreMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Seat Types */}
          <TabsContent value="seats">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>席種設定</CardTitle>
                    <CardDescription>テーブル、カウンターなどの席種を設定します</CardDescription>
                  </div>
                  <Dialog open={isAddSeatTypeOpen} onOpenChange={setIsAddSeatTypeOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        席種を追加
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>席種を追加</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>席種名 *</Label>
                          <Input
                            placeholder="テーブル、カウンター、個室など"
                            value={newSeatTypeName}
                            onChange={(e) => setNewSeatTypeName(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>最小人数</Label>
                            <Input
                              type="number"
                              min="1"
                              value={newSeatTypeMin}
                              onChange={(e) => setNewSeatTypeMin(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>最大人数</Label>
                            <Input
                              type="number"
                              min="1"
                              value={newSeatTypeMax}
                              onChange={(e) => setNewSeatTypeMax(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>席数</Label>
                            <Input
                              type="number"
                              min="1"
                              value={newSeatTypeTotal}
                              onChange={(e) => setNewSeatTypeTotal(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddSeatTypeOpen(false)}>
                          キャンセル
                        </Button>
                        <Button onClick={handleAddSeatType} disabled={createSeatTypeMutation.isPending}>
                          {createSeatTypeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          追加
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {seatTypes?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    席種が登録されていません
                  </div>
                ) : (
                  <div className="space-y-3">
                    {seatTypes?.map((seatType) => (
                      <div 
                        key={seatType.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{seatType.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {seatType.minPartySize}〜{seatType.maxPartySize}名 / 
                            空き {seatType.availableSeats}/{seatType.totalSeats}席
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-red-600"
                          onClick={() => handleDeleteSeatType(seatType.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>通知設定</CardTitle>
                <CardDescription>SMS/LINE通知の設定を行います</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">SMS通知</p>
                    <p className="text-sm text-muted-foreground">
                      電話番号宛にSMSで通知を送信します
                    </p>
                  </div>
                  <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
                </div>

                <div className="p-4 border rounded-lg">
                  <p className="font-medium mb-2">LINE連携</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    LINE公式アカウントと連携して通知を送信します
                  </p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Channel Access Token</Label>
                      <Input
                        type="password"
                        placeholder="LINE Developers で取得"
                        value={lineChannelAccessToken}
                        onChange={(e) => setLineChannelAccessToken(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Channel Secret</Label>
                      <Input
                        type="password"
                        placeholder="LINE Developers で取得"
                        value={lineChannelSecret}
                        onChange={(e) => setLineChannelSecret(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 border rounded-lg space-y-4">
                  <div>
                    <p className="font-medium mb-2">自動通知ルール</p>
                    <p className="text-sm text-muted-foreground">
                      待機中のパーティに自動で通知を送信する条件を設定します
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>順番が上位N組以内</Label>
                      <Input
                        type="number"
                        min="0"
                        value={autoNotifyRank}
                        onChange={(e) => setAutoNotifyRank(e.target.value)}
                      />
                      <p className="text-sm text-muted-foreground">
                        0を設定すると順位条件は無効になります
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>推定待ち時間がT分以内</Label>
                      <Input
                        type="number"
                        min="0"
                        value={autoNotifyMinutes}
                        onChange={(e) => setAutoNotifyMinutes(e.target.value)}
                      />
                      <p className="text-sm text-muted-foreground">
                        0を設定すると時間条件は無効になります
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-4">通知テンプレート</h3>
                  <div className="space-y-3">
                    {templates && templates.length > 0 ? (
                      templates.map((template) => (
                        <div key={template.id} className="p-4 border rounded-lg">
                          <p className="font-medium">{template.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.template}
                          </p>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="p-4 border rounded-lg">
                          <p className="font-medium">受付完了通知</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {"受付番号{{ticketNumber}}番でお受けしました。順番が近づきましたらお知らせします。"}
                          </p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <p className="font-medium">呼び出し通知</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {"{{ticketNumber}}番のお客様、お席の準備ができました。店頭までお越しください。"}
                          </p>
                        </div>
                        <div className="p-4 border rounded-lg">
                          <p className="font-medium">再呼び出し通知</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {"{{ticketNumber}}番のお客様、再度お呼び出しです。5分以内にお越しください。"}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <Button onClick={handleSaveNotifications} disabled={updateStoreMutation.isPending}>
                  {updateStoreMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Order Rules */}
          <TabsContent value="order">
            <Card>
              <CardHeader>
                <CardTitle>注文解放ルール</CardTitle>
                <CardDescription>
                  事前注文を許可する条件を設定します
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>順番が上位N組以内</Label>
                    <Input
                      type="number"
                      min="1"
                      value={orderReleaseRank}
                      onChange={(e) => setOrderReleaseRank(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      待ち順位がこの数以内のお客様に注文を許可します
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>推定待ち時間がT分以内</Label>
                    <Input
                      type="number"
                      min="1"
                      value={orderReleaseMinutes}
                      onChange={(e) => setOrderReleaseMinutes(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      推定待ち時間がこの分数以内のお客様に注文を許可します
                    </p>
                  </div>
                </div>
                <Button onClick={handleSaveStore} disabled={updateStoreMutation.isPending}>
                  {updateStoreMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
