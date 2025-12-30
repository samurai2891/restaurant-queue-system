import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, MapPin, Mail, Globe, Calendar, User } from "lucide-react";
import { Link } from "wouter";

export default function About() {
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
            <Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              機能
            </Link>
            <Link href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              料金
            </Link>
            <Link href="/about" className="text-sm text-foreground font-medium">
              会社概要
            </Link>
          </nav>

          <Link href="/">
            <Button variant="outline">トップへ戻る</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl font-bold mb-4">会社概要</h1>
            <p className="text-muted-foreground">
              合同会社Asobeは、飲食店向けのDXソリューションを提供しています。
            </p>
          </div>
        </div>
      </section>

      {/* Company Info */}
      <section className="py-16">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle>会社情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Store className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">会社名</p>
                      <p className="font-medium">合同会社Asobe</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">代表者名</p>
                      <p className="font-medium">山本健介</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">設立年月</p>
                      <p className="font-medium">2025年11月</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">所在地</p>
                      <p className="font-medium">
                        兵庫県神戸市中央区磯辺通1丁目1番18号<br />
                        カサベラ国際プラザビル707号室
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">メールアドレス</p>
                      <a 
                        href="mailto:contact@asobe-create.com" 
                        className="font-medium text-primary hover:underline"
                      >
                        contact@asobe-create.com
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">ホームページURL</p>
                      <a 
                        href="https://www.asobe-create.com/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        https://www.asobe-create.com/
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Mission */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>ミッション</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  私たちは、テクノロジーの力で飲食店の運営をより効率的に、
                  そしてお客様の体験をより快適にすることを目指しています。
                  順番待ちの時間を「待つだけの時間」から「価値ある時間」へと変え、
                  店舗とお客様の両方にとってWin-Winな関係を構築します。
                </p>
              </CardContent>
            </Card>

            {/* Services */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>提供サービス</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h3 className="font-semibold mb-2">QueuePro - 飲食店向け順番待ち管理システム</h3>
                    <p className="text-sm text-muted-foreground">
                      QRコードによる簡単受付、SMS/LINE通知、事前注文機能を備えた
                      次世代のキュー管理SaaSです。お客様はアプリのインストール不要で、
                      スマートフォンのブラウザから順番確認や注文が可能です。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2025 合同会社Asobe. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
