import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { 
  Store, 
  Plus, 
  Users, 
  Clock, 
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  Phone,
  Mail,
  ArrowLeft,
  Loader2,
  QrCode,
  RefreshCw,
  UserCheck,
  UserX
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

type PartyStatus = "waiting" | "notified" | "arrived" | "seated" | "canceled" | "noshow";

const statusConfig: Record<PartyStatus, { label: string; color: string; icon: React.ElementType }> = {
  waiting: { label: "待機中", color: "status-waiting", icon: Clock },
  notified: { label: "呼出済", color: "status-notified", icon: Bell },
  arrived: { label: "到着", color: "status-arrived", icon: UserCheck },
  seated: { label: "着席", color: "status-seated", icon: CheckCircle },
  canceled: { label: "キャンセル", color: "status-canceled", icon: XCircle },
  noshow: { label: "No-show", color: "status-noshow", icon: UserX },
};

export default function QueueManagement() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0");
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  
  // Form state
  const [guestName, setGuestName] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredSeatTypeId, setPreferredSeatTypeId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: parties, isLoading: partiesLoading, refetch: refetchParties } = trpc.party.list.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0, refetchInterval: 5000 }
  );

  const { data: seatTypes } = trpc.seatType.list.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const partySizeNumber = Number.parseInt(partySize, 10);
  const filteredSeatTypes = seatTypes?.filter(
    seatType =>
      partySizeNumber >= seatType.minPartySize && partySizeNumber <= seatType.maxPartySize
  ) ?? [];

  useEffect(() => {
    if (preferredSeatTypeId && !filteredSeatTypes.some(seatType => String(seatType.id) === preferredSeatTypeId)) {
      setPreferredSeatTypeId("");
    }
  }, [filteredSeatTypes, preferredSeatTypeId]);

  const createPartyMutation = trpc.party.create.useMutation({
    onSuccess: (data) => {
      toast.success(`受付番号 ${data.ticketNumber} で登録しました`);
      setIsAddDialogOpen(false);
      resetForm();
      refetchParties();
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const updateStatusMutation = trpc.party.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("ステータスを更新しました");
      refetchParties();
      setSelectedParty(null);
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const sendNotificationMutation = trpc.notification.send.useMutation({
    onSuccess: () => {
      toast.success("通知を送信しました");
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const toggleReceptionMutation = trpc.store.toggleReception.useMutation({
    onSuccess: () => {
      toast.success(store?.isReceptionPaused ? "受付を再開しました" : "受付を停止しました");
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const resetForm = () => {
    setGuestName("");
    setPartySize("2");
    setPhone("");
    setEmail("");
    setPreferredSeatTypeId("");
    setNotes("");
  };

  const handleCreateParty = () => {
    createPartyMutation.mutate({
      storeId: storeIdNum,
      guestName: guestName || undefined,
      partySize: parseInt(partySize),
      phone: phone || undefined,
      email: email || undefined,
      preferredSeatTypeId: preferredSeatTypeId ? parseInt(preferredSeatTypeId) : undefined,
      notes: notes || undefined,
    });
  };

  const handleUpdateStatus = (partyId: number, status: PartyStatus, seatTypeId?: number) => {
    updateStatusMutation.mutate({
      id: partyId,
      storeId: storeIdNum,
      status,
      assignedSeatTypeId: seatTypeId,
    });
  };

  const handleNotify = (partyId: number, type: "notify" | "remind") => {
    const party = parties?.find(p => p.id === partyId);
    if (!party) return;

    const channel = party.phone ? "sms" : party.email ? "email" : null;
    if (!channel) {
      toast.error("連絡先が登録されていません");
      return;
    }

    sendNotificationMutation.mutate({
      storeId: storeIdNum,
      partyId,
      type,
      channel,
    });

    if (type === "notify") {
      handleUpdateStatus(partyId, "notified");
    }
  };

  const filteredParties = parties?.filter(party => {
    if (activeTab === "all") return true;
    if (activeTab === "waiting") return party.status === "waiting";
    if (activeTab === "notified") return party.status === "notified" || party.status === "arrived";
    if (activeTab === "completed") return party.status === "seated" || party.status === "canceled" || party.status === "noshow";
    return true;
  });

  const waitingCount = parties?.filter(p => p.status === "waiting").length || 0;
  const notifiedCount = parties?.filter(p => p.status === "notified" || p.status === "arrived").length || 0;

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

  const guestRegisterUrl = `${window.location.origin}/guest/register/${storeIdNum}`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold">{store?.name}</h1>
              <p className="text-xs text-muted-foreground">キュー管理</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">受付</span>
              <Switch
                checked={!store?.isReceptionPaused}
                onCheckedChange={(checked) => {
                  toggleReceptionMutation.mutate({ id: storeIdNum, paused: !checked });
                }}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchParties()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              更新
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6">
        {/* Stats */}
        <div className="grid gap-4 mb-6 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">待機中</p>
                  <p className="text-2xl font-bold">{waitingCount}組</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">呼出中</p>
                  <p className="text-2xl font-bold">{notifiedCount}組</p>
                </div>
                <Bell className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          {seatTypes?.map(seatType => (
            <Card key={seatType.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{seatType.name}空き</p>
                    <p className="text-2xl font-bold">{seatType.availableSeats}/{seatType.totalSeats}</p>
                  </div>
                  <Users className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-4 mb-6">
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                新規受付
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新規受付</DialogTitle>
                <DialogDescription>お客様の情報を入力してください</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>お名前</Label>
                    <Input
                      placeholder="山田様"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>人数 *</Label>
                    <Select value={partySize} onValueChange={setPartySize}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}名</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>電話番号</Label>
                  <Input
                    type="tel"
                    placeholder="090-1234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>メールアドレス</Label>
                  <Input
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {seatTypes && seatTypes.length > 0 && (
                  <div className="space-y-2">
                    <Label>希望席種</Label>
                    <Select
                      value={preferredSeatTypeId}
                      onValueChange={setPreferredSeatTypeId}
                      disabled={filteredSeatTypes.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={filteredSeatTypes.length === 0 ? "該当する席種がありません" : "選択してください"} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSeatTypes.map(st => (
                          <SelectItem key={st.id} value={String(st.id)}>
                            {st.name} ({st.minPartySize}〜{st.maxPartySize}名)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {filteredSeatTypes.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        選択した人数に合う席種がありません。
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>備考</Label>
                  <Textarea
                    placeholder="アレルギー、ベビーカーなど"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleCreateParty} disabled={createPartyMutation.isPending}>
                  {createPartyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  受付
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <QrCode className="w-4 h-4" />
                QRコード
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>ゲスト受付QRコード</DialogTitle>
                <DialogDescription>
                  このQRコードをスキャンすると、お客様が自分で受付できます
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center py-4">
                <div className="p-4 bg-white rounded-lg">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(guestRegisterUrl)}`}
                    alt="QR Code"
                    className="w-48 h-48"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-4 text-center break-all">
                  {guestRegisterUrl}
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => {
                    navigator.clipboard.writeText(guestRegisterUrl);
                    toast.success("URLをコピーしました");
                  }}
                >
                  URLをコピー
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Queue List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">すべて</TabsTrigger>
            <TabsTrigger value="waiting">待機中 ({waitingCount})</TabsTrigger>
            <TabsTrigger value="notified">呼出中 ({notifiedCount})</TabsTrigger>
            <TabsTrigger value="completed">完了</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {partiesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredParties?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                該当する受付がありません
              </div>
            ) : (
              <div className="space-y-3">
                {filteredParties?.map((party, index) => {
                  const StatusIcon = statusConfig[party.status as PartyStatus]?.icon || Clock;
                  return (
                    <Card 
                      key={party.id} 
                      className={`cursor-pointer transition-all ${selectedParty?.id === party.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => setSelectedParty(party)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="text-center">
                              <div className="text-3xl font-bold text-primary">
                                {party.ticketNumber}
                              </div>
                              <div className="text-xs text-muted-foreground">番</div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {party.guestName || `お客様`}
                                </span>
                                <Badge variant="outline" className={statusConfig[party.status as PartyStatus]?.color}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {statusConfig[party.status as PartyStatus]?.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {party.partySize}名
                                </span>
                                {party.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {party.phone}
                                  </span>
                                )}
                                {party.preferredSeatType && (
                                  <span>{party.preferredSeatType.name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {party.status === "waiting" && (
                              <>
                                <Button 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNotify(party.id, "notify");
                                  }}
                                >
                                  <Bell className="w-4 h-4 mr-1" />
                                  呼出
                                </Button>
                              </>
                            )}
                            {party.status === "notified" && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNotify(party.id, "remind");
                                  }}
                                >
                                  再呼出
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateStatus(party.id, "arrived");
                                  }}
                                >
                                  <UserCheck className="w-4 h-4 mr-1" />
                                  到着
                                </Button>
                              </>
                            )}
                            {(party.status === "notified" || party.status === "arrived") && (
                              <Button 
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(
                                    party.id, 
                                    "seated", 
                                    party.preferredSeatTypeId || seatTypes?.[0]?.id
                                  );
                                }}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                着席
                              </Button>
                            )}
                            {(party.status === "waiting" || party.status === "notified") && (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(party.id, "canceled");
                                }}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {party.notes && (
                          <div className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded px-2 py-1">
                            {party.notes}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
