import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { 
  Clock, 
  Users, 
  Bell, 
  Smartphone, 
  BarChart3, 
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Store,
  ChefHat,
  QrCode
} from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  const features = [
    {
      icon: Users,
      title: "順番待ち管理",
      description: "QRコードで簡単受付。ゲストはアプリ不要でスマホから順番確認可能。"
    },
    {
      icon: Bell,
      title: "SMS/LINE通知",
      description: "呼び出し通知を自動送信。再呼び出しやリマインドも簡単に。"
    },
    {
      icon: Clock,
      title: "待ち時間予測",
      description: "AIが過去データから待ち時間を自動推定。お客様の離脱を防止。"
    },
    {
      icon: ChefHat,
      title: "事前注文",
      description: "待ち時間中に注文可能。売上機会を最大化し、回転率を向上。"
    },
    {
      icon: BarChart3,
      title: "分析ダッシュボード",
      description: "離脱率、No-show率、通知反応率など詳細な分析レポート。"
    },
    {
      icon: ShieldCheck,
      title: "権限管理",
      description: "店長・ホスト・スタッフの役割別アクセス制御と監査ログ。"
    }
  ];

  const plans = [
    {
      name: "Free",
      price: "¥0",
      period: "/月",
      description: "小規模店舗向け",
      features: ["1店舗まで", "基本的なキュー管理", "SMS通知（月100件）", "基本分析"],
      cta: "無料で始める",
      popular: false
    },
    {
      name: "Standard",
      price: "¥9,800",
      period: "/月",
      description: "成長中の店舗向け",
      features: ["3店舗まで", "事前注文機能", "LINE連携", "SMS通知（月500件）", "詳細分析", "優先サポート"],
      cta: "14日間無料トライアル",
      popular: true
    },
    {
      name: "Premium",
      price: "¥29,800",
      period: "/月",
      description: "多店舗展開向け",
      features: ["無制限の店舗", "全機能利用可能", "SMS通知（月2000件）", "API連携", "専任サポート", "カスタマイズ対応"],
      cta: "お問い合わせ",
      popular: false
    }
  ];

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
          
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              機能
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              料金
            </Link>
            <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              会社概要
            </Link>
            <Link href="/guest" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ゲスト入口
            </Link>
            <Link href="/staff" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              スタッフ入口
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : isAuthenticated ? (
              <Link href="/admin">
                <Button>管理者ダッシュボード</Button>
              </Link>
            ) : (
              <>
                <a href={getLoginUrl()}>
                  <Button variant="ghost">スタッフ/管理者ログイン</Button>
                </a>
                <Link href="/guest">
                  <Button variant="outline">ゲスト入口</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="container relative">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm text-primary mb-6">
              <Smartphone className="w-4 h-4" />
              アプリインストール不要
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              飲食店の順番待ちを
              <span className="text-primary">スマート</span>に
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              QRコードで簡単受付、SMS/LINEで自動呼び出し。
              待ち時間を売上機会に変える次世代キュー管理システム。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Link href="/admin">
                  <Button size="lg" className="gap-2">
                    管理者ダッシュボードへ
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <a href={getLoginUrl()}>
                    <Button size="lg" className="gap-2">
                      スタッフ/管理者ログイン
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </a>
                  <Link href="/guest">
                    <Button size="lg" variant="outline">
                      ゲスト入口
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Hero Image/Demo */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
            <div className="rounded-xl border bg-card shadow-2xl overflow-hidden mx-auto max-w-5xl">
              <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="text-xs text-muted-foreground ml-2">QueuePro Dashboard</span>
              </div>
              <div className="p-6 bg-gradient-to-br from-muted/30 to-muted/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="card-hover">
                    <CardHeader className="pb-2">
                      <CardDescription>現在の待ち組数</CardDescription>
                      <CardTitle className="text-3xl">12組</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="card-hover">
                    <CardHeader className="pb-2">
                      <CardDescription>平均待ち時間</CardDescription>
                      <CardTitle className="text-3xl">23分</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="card-hover">
                    <CardHeader className="pb-2">
                      <CardDescription>本日の着席数</CardDescription>
                      <CardTitle className="text-3xl">48組</CardTitle>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">すべての機能をひとつに</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              順番待ち管理から事前注文、分析まで。飲食店運営に必要な機能を網羅。
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="card-hover">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">かんたん3ステップ</h2>
            <p className="text-muted-foreground">お客様はアプリのインストール不要</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">1. QRコードで受付</h3>
              <p className="text-sm text-muted-foreground">
                店頭のQRコードをスキャンするだけ。人数と連絡先を入力して完了。
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">2. 順番を確認</h3>
              <p className="text-sm text-muted-foreground">
                Webページでリアルタイムに順番を確認。待ち時間中に注文も可能。
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. 通知で呼び出し</h3>
              <p className="text-sm text-muted-foreground">
                順番が来たらSMS/LINEで自動通知。店内にいなくても安心。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">シンプルな料金プラン</h2>
            <p className="text-muted-foreground">店舗の規模に合わせて選べる3つのプラン</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative card-hover ${plan.popular ? 'border-primary shadow-lg' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      人気
                    </span>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <div className="rounded-2xl gradient-primary p-8 md:p-12 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              今すぐ始めましょう
            </h2>
            <p className="text-white/80 mb-8 max-w-2xl mx-auto">
              14日間の無料トライアルで、QueueProの全機能をお試しいただけます。
              クレジットカード不要、いつでもキャンセル可能。
            </p>
            {isAuthenticated ? (
              <Link href="/admin">
                <Button size="lg" variant="secondary" className="gap-2">
                  管理者ダッシュボードへ
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a href={getLoginUrl()}>
                  <Button size="lg" variant="secondary" className="gap-2">
                    スタッフ/管理者ログイン
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
                <Link href="/guest">
                  <Button size="lg" variant="outline" className="gap-2">
                    ゲスト入口
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                  <Store className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl">QueuePro</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                飲食店の順番待ちをスマートに。
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">製品</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#features" className="hover:text-foreground">機能</Link></li>
                <li><Link href="#pricing" className="hover:text-foreground">料金</Link></li>
                <li><Link href="/about" className="hover:text-foreground">会社概要</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">サポート</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="mailto:contact@asobe-create.com" className="hover:text-foreground">お問い合わせ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">運営会社</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>合同会社Asobe</li>
                <li>兵庫県神戸市中央区</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            © 2025 合同会社Asobe. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
