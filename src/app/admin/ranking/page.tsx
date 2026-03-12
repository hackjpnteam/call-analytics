'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PeriodTabs, Period } from '@/components/dashboard/period-tabs';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Trophy,
  Medal,
  Award,
  Phone,
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  RefreshCw,
} from 'lucide-react';
import { FullPageLoading } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';

interface UserStats {
  id: string;
  name: string;
  email: string;
  totalCalls: number;
  connectedCalls: number;
  totalDuration: number;
  averageDuration: number;
  connectionRate: number;
}

type RankingCriteria = 'totalCalls' | 'connectedCalls' | 'connectionRate' | 'totalDuration' | 'averageDuration';

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Trophy className="h-6 w-6 text-yellow-500" />;
    case 2:
      return <Medal className="h-6 w-6 text-gray-400" />;
    case 3:
      return <Award className="h-6 w-6 text-amber-600" />;
    default:
      return <span className="text-gray-500 font-bold text-lg">{rank}</span>;
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}時間${mins}分`;
  }
  return `${mins}分`;
}

function getValue(criteria: RankingCriteria, user: UserStats): number {
  switch (criteria) {
    case 'totalCalls': return user.totalCalls;
    case 'connectedCalls': return user.connectedCalls;
    case 'connectionRate': return user.connectionRate;
    case 'totalDuration': return user.totalDuration;
    case 'averageDuration': return user.averageDuration;
    default: return 0;
  }
}

function formatValue(criteria: RankingCriteria, user: UserStats): string {
  switch (criteria) {
    case 'totalCalls': return `${user.totalCalls}件`;
    case 'connectedCalls': return `${user.connectedCalls}件`;
    case 'connectionRate': return `${user.connectionRate.toFixed(1)}%`;
    case 'totalDuration': return formatDuration(user.totalDuration);
    case 'averageDuration': return formatDuration(user.averageDuration);
    default: return '';
  }
}

export default function RankingPage() {
  const { data: session, status } = useSession();
  const [period, setPeriod] = useState<Period>('weekly');
  const [criteria, setCriteria] = useState<RankingCriteria>('totalCalls');
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      redirect('/login');
      return;
    }
    if (session.user.role !== 'admin') {
      redirect('/');
    }
  }, [session, status]);

  const fetchData = async () => {
    if (!session) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ranking?period=${period}`);
      if (res.ok) {
        const data = await res.json();
        // APIから返されたユーザーをUserStats形式に変換
        const formattedUsers: UserStats[] = (data.users || [])
          .map((u: { id: string; name: string; email: string; summary: { totalCalls: number; connectedCalls: number; totalDuration: number; averageDuration: number } }) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            totalCalls: u.summary.totalCalls,
            connectedCalls: u.summary.connectedCalls,
            totalDuration: u.summary.totalDuration,
            averageDuration: u.summary.averageDuration,
            connectionRate: u.summary.totalCalls > 0
              ? (u.summary.connectedCalls / u.summary.totalCalls) * 100
              : 0,
          }))
          .filter((u: UserStats) => u.totalCalls > 0); // 0件を除外

        setUsers(formattedUsers);
      }
    } catch (error) {
      console.error('Failed to fetch ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session, period]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/sync/auto', { method: 'POST' });
      await fetchData();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  };

  // ソート済みユーザー
  const sortedUsers = useMemo(() => {
    return [...users]
      .filter(u => u.totalCalls > 0) // 二重チェック
      .sort((a, b) => getValue(criteria, b) - getValue(criteria, a));
  }, [users, criteria]);

  if (status === 'loading' || loading) {
    return <FullPageLoading />;
  }

  if (!session || session.user.role !== 'admin') {
    return null;
  }

  const periodLabels = {
    daily: '今日',
    weekly: '今週',
    monthly: '今月',
  };

  const top3 = sortedUsers.slice(0, 3);

  return (
    <DashboardLayout
      userRole={session.user.role}
      userName={session.user.name}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">オペレーターランキング</h1>
            <p className="text-gray-600">{periodLabels[period]}のパフォーマンス</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              同期
            </Button>
            <PeriodTabs value={period} onChange={setPeriod} />
          </div>
        </div>

        {/* ランキング基準タブ */}
        <Tabs value={criteria} onValueChange={(v) => setCriteria(v as RankingCriteria)}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="totalCalls" className="flex items-center gap-1">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">総通話数</span>
            </TabsTrigger>
            <TabsTrigger value="connectedCalls" className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">接続数</span>
            </TabsTrigger>
            <TabsTrigger value="connectionRate" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">接続率</span>
            </TabsTrigger>
            <TabsTrigger value="totalDuration" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">総通話時間</span>
            </TabsTrigger>
            <TabsTrigger value="averageDuration" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">平均時間</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {sortedUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>この期間の通話データがありません</p>
                <p className="text-sm mt-2">期間を変更するか、同期ボタンを押してください</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* トップ3カード */}
            {top3.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {top3.map((user, index) => (
                  <Card key={user.id} className={index === 0 ? 'border-yellow-400 border-2' : ''}>
                    <CardContent className="pt-6">
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-2">
                          {getRankIcon(index + 1)}
                        </div>
                        <Avatar className="h-16 w-16 mb-3">
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xl">
                            {user.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="font-bold text-lg">{user.name}</h3>
                        <p className="text-sm text-gray-500 mb-3">{user.email}</p>
                        <div className="text-3xl font-bold text-blue-600">
                          {formatValue(criteria, user)}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-4 text-sm text-gray-500 w-full">
                          <div>
                            <p className="font-medium">{user.totalCalls}</p>
                            <p className="text-xs">総通話</p>
                          </div>
                          <div>
                            <p className="font-medium">{user.connectedCalls}</p>
                            <p className="text-xs">接続</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* 全ユーザーテーブル */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  全オペレーター一覧（{sortedUsers.length}名）
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">順位</TableHead>
                      <TableHead>オペレーター</TableHead>
                      <TableHead className="text-right">総通話数</TableHead>
                      <TableHead className="text-right">接続数</TableHead>
                      <TableHead className="text-right">接続率</TableHead>
                      <TableHead className="text-right">総通話時間</TableHead>
                      <TableHead className="text-right">平均通話時間</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedUsers.map((user, index) => (
                      <TableRow key={user.id} className={index < 3 ? 'bg-yellow-50' : ''}>
                        <TableCell>
                          <div className="flex items-center justify-center w-8">
                            {getRankIcon(index + 1)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarFallback className="bg-blue-100 text-blue-700">
                                {user.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{user.name}</p>
                              <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {user.totalCalls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.connectedCalls.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="secondary"
                            className={
                              user.connectionRate >= 50
                                ? 'bg-green-100 text-green-800'
                                : user.connectionRate >= 30
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }
                          >
                            {user.connectionRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDuration(user.totalDuration)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDuration(user.averageDuration)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
