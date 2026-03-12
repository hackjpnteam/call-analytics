'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PeriodTabs, Period } from '@/components/dashboard/period-tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Phone,
  Target,
} from 'lucide-react';
import { FullPageLoading } from '@/components/ui/loading-spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type RankingCategory = 'totalCalls' | 'connectedCalls' | 'connectionRate' | 'avgDuration' | 'totalDuration';

interface AnalyticsData {
  hourlyStats: Array<{ hour: string; totalCalls: number; connectedCalls: number }>;
  dayOfWeekStats: Array<{ day: string; totalCalls: number; connectedCalls: number; connectionRate: number }>;
  resultBreakdown: Array<{ name: string; value: number; color: string }>;
  userPerformance: Array<{
    name: string;
    totalCalls: number;
    connectedCalls: number;
    connectionRate: number;
    avgDuration: number;
    totalDuration: number;
  }>;
  dailyStats: Array<{ date: string; totalCalls: number; connectedCalls: number; totalDuration: number }>;
  totalSummary: { totalCalls: number; connectedCalls: number; totalDuration: number; averageDuration: number };
  comparison: {
    current: { totalCalls: number; connectedCalls: number };
    previous: { totalCalls: number; connectedCalls: number };
    callsChange: number;
    connectedChange: number;
  };
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('daily');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankingCategory, setRankingCategory] = useState<RankingCategory>('totalCalls');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'admin') {
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!session) return;

      setLoading(true);
      try {
        const res = await fetch('/api/analytics');
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  if (status === 'loading' || loading) {
    return <FullPageLoading />;
  }

  if (!session || session.user.role !== 'admin') {
    return null;
  }

  const hourlyStats = data?.hourlyStats || [];
  const dayOfWeekStats = data?.dayOfWeekStats || [];
  const resultBreakdown = data?.resultBreakdown || [];
  const userPerformance = data?.userPerformance || [];
  const periodStats = data?.dailyStats || [];
  const totalSummary = data?.totalSummary || { totalCalls: 0, connectedCalls: 0, totalDuration: 0, averageDuration: 0 };
  const comparison = data?.comparison;

  const periodLabels = {
    daily: '日次',
    weekly: '週次',
    monthly: '月次',
  };

  const hasData = totalSummary.totalCalls > 0;

  // ランキングカテゴリーに応じてソート
  const rankingCategoryLabels: Record<RankingCategory, string> = {
    totalCalls: '総通話数',
    connectedCalls: '接続数',
    connectionRate: '接続率',
    avgDuration: '平均通話時間',
    totalDuration: '総通話時間',
  };

  const sortedUserPerformance = [...userPerformance].sort((a, b) => {
    return b[rankingCategory] - a[rankingCategory];
  });

  return (
    <DashboardLayout
      userRole={session.user.role}
      userName={session.user.name}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">分析</h1>
            <p className="text-gray-600">架電データの詳細分析</p>
          </div>
          <PeriodTabs value={period} onChange={setPeriod} />
        </div>

        {!hasData ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Phone className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>分析データがありません</p>
                <p className="text-sm mt-2">Zoom Phoneと同期すると分析データが表示されます</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 前期比較 */}
            {comparison && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">今期 総通話数</p>
                        <p className="text-2xl font-bold">{comparison.current.totalCalls}</p>
                      </div>
                      <div className={`flex items-center ${comparison.callsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {comparison.callsChange >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                        <span className="ml-1 font-medium">{comparison.callsChange}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">前期: {comparison.previous.totalCalls}件</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">今期 接続数</p>
                        <p className="text-2xl font-bold">{comparison.current.connectedCalls}</p>
                      </div>
                      <div className={`flex items-center ${comparison.connectedChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {comparison.connectedChange >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                        <span className="ml-1 font-medium">{comparison.connectedChange}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">前期: {comparison.previous.connectedCalls}件</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">全体 接続率</p>
                        <p className="text-2xl font-bold">
                          {totalSummary.totalCalls > 0
                            ? Math.round((totalSummary.connectedCalls / totalSummary.totalCalls) * 100)
                            : 0}%
                        </p>
                      </div>
                      <Target className="h-8 w-8 text-blue-500" />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">目標: 50%</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500">平均通話時間</p>
                        <p className="text-2xl font-bold">
                          {Math.floor(totalSummary.averageDuration / 60)}分{totalSummary.averageDuration % 60}秒
                        </p>
                      </div>
                      <Clock className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* グラフエリア */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 時間帯別通話数 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    時間帯別通話数
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hourlyStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalCalls" name="総通話数" fill="#3b82f6" />
                      <Bar dataKey="connectedCalls" name="接続数" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 曜日別パフォーマンス */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">曜日別接続率</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dayOfWeekStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="connectionRate" name="接続率" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 通話結果内訳 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    通話結果内訳
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={resultBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {resultBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* トレンドチャート */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{periodLabels[period]}トレンド</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={periodStats.slice(-14)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="totalCalls"
                        name="総通話数"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.3}
                      />
                      <Area
                        type="monotone"
                        dataKey="connectedCalls"
                        name="接続数"
                        stroke="#22c55e"
                        fill="#22c55e"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* ユーザー別パフォーマンス */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    ユーザー別パフォーマンス
                  </CardTitle>
                  <Tabs value={rankingCategory} onValueChange={(v) => setRankingCategory(v as RankingCategory)}>
                    <TabsList className="grid grid-cols-5 w-full sm:w-auto">
                      <TabsTrigger value="totalCalls" className="text-xs px-2">通話数</TabsTrigger>
                      <TabsTrigger value="connectedCalls" className="text-xs px-2">接続数</TabsTrigger>
                      <TabsTrigger value="connectionRate" className="text-xs px-2">接続率</TabsTrigger>
                      <TabsTrigger value="avgDuration" className="text-xs px-2">平均時間</TabsTrigger>
                      <TabsTrigger value="totalDuration" className="text-xs px-2">総時間</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {sortedUserPerformance.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">データがありません</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4">順位</th>
                          <th className="text-left py-3 px-4">担当者</th>
                          <th className={`text-right py-3 px-4 ${rankingCategory === 'totalCalls' ? 'bg-blue-50 text-blue-700' : ''}`}>総通話数</th>
                          <th className={`text-right py-3 px-4 ${rankingCategory === 'connectedCalls' ? 'bg-blue-50 text-blue-700' : ''}`}>接続数</th>
                          <th className={`text-right py-3 px-4 ${rankingCategory === 'connectionRate' ? 'bg-blue-50 text-blue-700' : ''}`}>接続率</th>
                          <th className={`text-right py-3 px-4 ${rankingCategory === 'avgDuration' ? 'bg-blue-50 text-blue-700' : ''}`}>平均通話時間</th>
                          <th className={`text-right py-3 px-4 ${rankingCategory === 'totalDuration' ? 'bg-blue-50 text-blue-700' : ''}`}>総通話時間</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedUserPerformance.map((user, index) => (
                          <tr key={user.name} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                index === 0 ? 'bg-yellow-100 text-yellow-800' :
                                index === 1 ? 'bg-gray-100 text-gray-800' :
                                index === 2 ? 'bg-amber-100 text-amber-800' :
                                'bg-white text-gray-600'
                              }`}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium">{user.name}</td>
                            <td className={`py-3 px-4 text-right ${rankingCategory === 'totalCalls' ? 'bg-blue-50 font-semibold' : ''}`}>{user.totalCalls}</td>
                            <td className={`py-3 px-4 text-right ${rankingCategory === 'connectedCalls' ? 'bg-blue-50 font-semibold' : ''}`}>{user.connectedCalls}</td>
                            <td className={`py-3 px-4 text-right ${rankingCategory === 'connectionRate' ? 'bg-blue-50' : ''}`}>
                              <span className={`px-2 py-1 rounded text-xs ${
                                user.connectionRate >= 50 ? 'bg-green-100 text-green-800' :
                                user.connectionRate >= 30 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              } ${rankingCategory === 'connectionRate' ? 'font-semibold' : ''}`}>
                                {user.connectionRate}%
                              </span>
                            </td>
                            <td className={`py-3 px-4 text-right ${rankingCategory === 'avgDuration' ? 'bg-blue-50 font-semibold' : ''}`}>{user.avgDuration}分</td>
                            <td className={`py-3 px-4 text-right ${rankingCategory === 'totalDuration' ? 'bg-blue-50 font-semibold' : ''}`}>{user.totalDuration}分</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
