import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { Link, useParams } from "wouter";

export default function Register() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0", 10);
  const { loading: authLoading, isAuthenticated } = useAuth();

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  if (authLoading || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/queue/${storeIdNum}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">レジ</h1>
          <p className="text-sm text-muted-foreground">{store?.name ?? "店舗"}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CreditCard className="h-5 w-5" />
            <CardTitle>会計の準備中</CardTitle>
          </div>
          <CardDescription>
            レジ画面は現在準備中です。注文受付は「注文受付」から行えます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button asChild>
              <Link href={`/cashier/${storeIdNum}`}>注文受付へ</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/queue/${storeIdNum}`}>キュー管理へ</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
