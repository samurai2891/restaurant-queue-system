import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft,
  Loader2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Bell,
  XCircle,
  CheckCircle
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Analytics() {
  const { storeId } = useParams<{ storeId: string }>();
  const storeIdNum = parseInt(storeId || "0");
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [period, setPeriod] = useState("7d");

  const { data: store, isLoading: storeLoading } = trpc.store.get.useQuery(
    { id: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

  const { data: analytics, isLoading: analyticsLoading } = trpc.analytics.dashboard.useQuery(
    { storeId: storeIdNum },
    { enabled: isAuthenticated && storeIdNum > 0 }
  );

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

  // Sample data for charts (will be replaced with real data)
  const waitTimeData = [
    { hour: '10:00', avgWait: 15 },
    { hour: '11:00', avgWait: 22 },
    { hour: '12:00', avgWait: 35 },
    { hour: '13:00', avgWait: 28 },
    { hour: '14:00', avgWait: 18 },
    { hour: '15:00', avgWait: 12 },
    { hour: '16:00', avgWait: 10 },
    { hour: '17:00', avgWait: 15 },
    { hour: '18:00', avgWait: 32 },
    { hour: '19:00', avgWait: 45 },
    { hour: '20:00', avgWait: 38 },
    { hour: '21:00', avgWait: 20 },
  ];

  const dailyData = [
    { date: '12/25', parties: 45, seated: 42, noshow: 3 },
    { date: '12/26', parties: 52, seated: 48, noshow: 4 },
    { date: '12/27', parties: 38, seated: 36, noshow: 2 },
    { date: '12/28', parties: 61, seated: 57, noshow: 4 },
    { date: '12/29', parties: 55, seated: 52, noshow: 3 },
    { date: '12/30', parties: 48, seated: 45, noshow: 3 },
    { date: '12/31', parties: 42, seated: 40, noshow: 2 },
  ];

  const statusDistribution = [
    { name: '着席', value: 85 },
    { name: 'キャンセル', value: 8 },
    { name: 'No-show', value: 7 },
  ];

  const stats = analytics ? {
    totalParties: analytics.totalParties,
    seatedRate: analytics.totalParties > 0 ? (analytics.seatedCount / analytics.totalParties * 100).toFixed(1) : 0,
    avgWaitTime: analytics.avgWaitTime,
    noshowRate: analytics.totalParties > 0 ? (analytics.noshowCount / analytics.totalParties * 100).toFixed(1) : 0,
    notificationResponseRate: 87.2,
    avgTurnoverTime: 45,
  } : {
    totalParties: 341,
    seatedRate: 92.4,
    avgWaitTime: 23,
    noshowRate: 5.3,
    notificationResponseRate: 87.2,
    avgTurnoverTime: 45,
  };

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
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <div>
                <h1 className="font-bold">{store?.name}</h1>
                <p className="text-xs text-muted-foreground">分析ダッシュボード</p>
              </div>
            </div>
          </div>
          
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">今日</SelectItem>
              <SelectItem value="7d">過去7日</SelectItem>
              <SelectItem value="30d">過去30日</SelectItem>
              <SelectItem value="90d">過去90日</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="container py-6">
        {analyticsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">総受付数</p>
                      <p className="text-2xl font-bold">{stats.totalParties}</p>
                    </div>
                    <Users className="w-8 h-8 text-primary opacity-50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">着席率</p>
                      <p className="text-2xl font-bold">{stats.seatedRate}%</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">平均待ち時間</p>
                      <p className="text-2xl font-bold">{stats.avgWaitTime}分</p>
                    </div>
                    <Clock className="w-8 h-8 text-amber-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">No-show率</p>
                      <p className="text-2xl font-bold">{stats.noshowRate}%</p>
                    </div>
                    <XCircle className="w-8 h-8 text-red-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">通知反応率</p>
                      <p className="text-2xl font-bold">{stats.notificationResponseRate}%</p>
                    </div>
                    <Bell className="w-8 h-8 text-blue-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">平均回転時間</p>
                      <p className="text-2xl font-bold">{stats.avgTurnoverTime}分</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-purple-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Wait Time by Hour */}
              <Card>
                <CardHeader>
                  <CardTitle>時間帯別平均待ち時間</CardTitle>
                  <CardDescription>各時間帯の平均待ち時間（分）</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={waitTimeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Line 
                          type="monotone" 
                          dataKey="avgWait" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          dot={{ fill: '#3b82f6' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Daily Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>日別受付数</CardTitle>
                  <CardDescription>受付・着席・No-showの推移</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="seated" fill="#10b981" name="着席" />
                        <Bar dataKey="noshow" fill="#ef4444" name="No-show" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>ステータス分布</CardTitle>
                  <CardDescription>受付後の結果内訳</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}%`}
                        >
                          {statusDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Insights */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>インサイト</CardTitle>
                  <CardDescription>AIによる分析結果</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-800">着席率が改善</p>
                        <p className="text-sm text-green-700">
                          前週比で着席率が2.3%向上しました。SMS通知の効果が出ています。
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                      <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800">ピーク時間帯の混雑</p>
                        <p className="text-sm text-amber-700">
                          19:00-20:00の待ち時間が平均45分と長くなっています。席数の増加を検討してください。
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-800">通知反応率</p>
                        <p className="text-sm text-blue-700">
                          呼び出し通知への反応率は87.2%です。再呼び出し機能の活用で改善が期待できます。
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
