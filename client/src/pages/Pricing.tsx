import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Pricing() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const { data: plans, isLoading: plansLoading } = trpc.subscription.plans.useQuery();

  const createCheckoutMutation = trpc.subscription.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        toast.info("決済ページへ移動します...");
        window.open(data.url, "_blank");
      }
    },
    onError: (error) => {
      toast.error(`エラー: ${error.message}`);
    },
  });

  const handleSelectPlan = (planId: string) => {
    if (!isAuthenticated) {
      toast.error("プランを選択するにはログインが必要です");
      return;
    }
    
    if (planId === "free") {
      toast.info("フリープランは登録後すぐにご利用いただけます");
      return;
    }

    // ダッシュボードから店舗を選択して購入する必要がある
    toast.info("ダッシュボードから店舗を選択してプランをアップグレードしてください");
  };

  if (plansLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">Q</span>
              </div>
              <span className="font-bold text-lg">QueuePro</span>
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              機能
            </Link>
            <Link href="/pricing" className="text-sm font-medium">
              料金
            </Link>
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              会社概要
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/admin">
                <Button>ダッシュボード</Button>
              </Link>
            ) : (
              <Link href="/admin">
                <Button>無料で始める</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="container py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            シンプルな料金体系
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            あなたのビジネスに<span className="text-primary">最適なプラン</span>を
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            すべてのプランで基本機能をご利用いただけます。
            ビジネスの成長に合わせてアップグレードできます。
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans?.map((plan) => {
            const isPopular = plan.id === "standard";
            const isFree = plan.id === "free";

            return (
              <Card 
                key={plan.id} 
                className={`relative ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      人気No.1
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="text-center">
                  <div className="mb-6">
                    <span className="text-4xl font-bold">
                      ¥{plan.price.toLocaleString()}
                    </span>
                    {!isFree && (
                      <span className="text-muted-foreground">/月</span>
                    )}
                  </div>
                  
                  <ul className="space-y-3 text-left">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {isFree ? "無料で始める" : "このプランを選択"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">よくある質問</h2>
          
          <div className="space-y-6">
            <div className="bg-card rounded-lg p-6 border">
              <h3 className="font-semibold mb-2">プランの変更はいつでもできますか？</h3>
              <p className="text-muted-foreground text-sm">
                はい、いつでもプランのアップグレード・ダウングレードが可能です。
                アップグレードは即座に反映され、ダウングレードは次の請求サイクルから適用されます。
              </p>
            </div>
            
            <div className="bg-card rounded-lg p-6 border">
              <h3 className="font-semibold mb-2">支払い方法は何が使えますか？</h3>
              <p className="text-muted-foreground text-sm">
                クレジットカード（Visa、Mastercard、American Express、JCB）に対応しています。
                決済はStripeを通じて安全に処理されます。
              </p>
            </div>
            
            <div className="bg-card rounded-lg p-6 border">
              <h3 className="font-semibold mb-2">解約した場合、データはどうなりますか？</h3>
              <p className="text-muted-foreground text-sm">
                解約後もデータは30日間保持されます。
                フリープランにダウングレードして継続利用することも可能です。
              </p>
            </div>
            
            <div className="bg-card rounded-lg p-6 border">
              <h3 className="font-semibold mb-2">無料トライアルはありますか？</h3>
              <p className="text-muted-foreground text-sm">
                フリープランで基本機能をお試しいただけます。
                有料プランへのアップグレード時は、14日間の返金保証がございます。
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-24 text-center">
          <h2 className="text-2xl font-bold mb-4">まずは無料で始めましょう</h2>
          <p className="text-muted-foreground mb-6">
            クレジットカード不要で今すぐ始められます
          </p>
          <Link href="/admin">
            <Button size="lg">
              無料で始める
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-16">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2025 合同会社Asobe. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
