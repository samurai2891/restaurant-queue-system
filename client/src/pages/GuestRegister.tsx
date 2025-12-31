import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { 
  Store, 
  Users, 
  Phone,
  Mail,
  Loader2,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { toast } from "sonner";

export default function GuestRegister() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0");
  const [, setLocation] = useLocation();
  
  const [guestName, setGuestName] = useState("");
  const [partySize, setPartySize] = useState("2");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredSeatTypeId, setPreferredSeatTypeId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<number | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const { data: store, isLoading: storeLoading, error: storeError } = trpc.publicStore.get.useQuery(
    { id: storeIdNum },
    { enabled: storeIdNum > 0 }
  );

  const { data: seatTypes } = trpc.publicStore.seatTypes.useQuery(
    { storeId: storeIdNum },
    { enabled: storeIdNum > 0 }
  );

  const partySizeNumber = Number.parseInt(partySize, 10);
  const filteredSeatTypes = seatTypes?.filter(
    (st: { minPartySize: number; maxPartySize: number }) =>
      partySizeNumber >= st.minPartySize && partySizeNumber <= st.maxPartySize
  ) ?? [];

  useEffect(() => {
    if (preferredSeatTypeId && !filteredSeatTypes.some(st => String(st.id) === preferredSeatTypeId)) {
      setPreferredSeatTypeId("");
    }
  }, [filteredSeatTypes, preferredSeatTypeId]);

  const registerMutation = trpc.party.guestRegister.useMutation({
    onSuccess: (data) => {
      setIsSubmitted(true);
      setTicketNumber(data.ticketNumber);
      setAccessToken(data.accessToken);
      toast.success("受付が完了しました");
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone && !email) {
      toast.error("電話番号またはメールアドレスを入力してください");
      return;
    }

    registerMutation.mutate({
      storeId: storeIdNum,
      guestName: guestName || undefined,
      partySize: parseInt(partySize),
      phone: phone || undefined,
      email: email || undefined,
      preferredSeatTypeId: preferredSeatTypeId ? parseInt(preferredSeatTypeId) : undefined,
      notes: notes || undefined,
    });
  };

  const handleViewStatus = () => {
    if (accessToken) {
      setLocation(`/guest/status/${accessToken}`);
    }
  };

  if (storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-medium">店舗が見つかりません</p>
            <p className="text-sm text-muted-foreground mt-2">
              URLが正しいかご確認ください
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (store.isReceptionPaused) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <p className="text-lg font-medium">現在受付を停止しています</p>
            <p className="text-sm text-muted-foreground mt-2">
              しばらくしてから再度お試しください
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted && ticketNumber) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">受付完了</CardTitle>
            <CardDescription>{store.name}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="bg-primary/10 rounded-2xl p-6 mb-6">
              <p className="text-sm text-muted-foreground mb-2">受付番号</p>
              <p className="queue-number text-primary">{ticketNumber}</p>
            </div>
            
            <p className="text-sm text-muted-foreground mb-6">
              順番が近づきましたら、ご登録の連絡先にお知らせします。
              このページをブックマークするか、下のボタンから順番を確認できます。
            </p>

            <Button className="w-full" size="lg" onClick={handleViewStatus}>
              順番を確認する
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 p-4">
      <div className="max-w-md mx-auto pt-8">
        {/* Store Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">{store.name}</h1>
          <p className="text-muted-foreground">順番待ち受付</p>
        </div>

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle>受付情報入力</CardTitle>
            <CardDescription>
              お客様の情報を入力してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guestName">お名前（任意）</Label>
                <Input
                  id="guestName"
                  placeholder="山田 太郎"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="partySize">人数 *</Label>
                <Select value={partySize} onValueChange={setPartySize}>
                  <SelectTrigger id="partySize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <SelectItem key={n} value={String(n)}>
                        <span className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {n}名
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">
                  <span className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    電話番号
                  </span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="090-1234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  SMSで呼び出し通知を受け取れます
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    メールアドレス
                  </span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {seatTypes && seatTypes.length > 0 && (
                <div className="space-y-2">
                  <Label>希望の席種（任意）</Label>
                  <Select
                    value={preferredSeatTypeId}
                    onValueChange={setPreferredSeatTypeId}
                    disabled={filteredSeatTypes.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={filteredSeatTypes.length === 0 ? "該当する席種がありません" : "選択してください"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSeatTypes.map((st: { id: number; name: string; minPartySize: number; maxPartySize: number }) => (
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
                <Label htmlFor="notes">備考（任意）</Label>
                <Textarea
                  id="notes"
                  placeholder="アレルギー、ベビーカー、車椅子など"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    受付中...
                  </>
                ) : (
                  '受付する'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by QueuePro
        </p>
      </div>
    </div>
  );
}
