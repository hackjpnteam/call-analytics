'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PeriodTabs, Period } from '@/components/dashboard/period-tabs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'lucide-react';
import { FullPageLoading } from '@/components/ui/loading-spinner';

interface UserRankingData {
  id: string;
  name: string;
  email: string;
  summary: {
    totalCalls: number;
    connectedCalls: number;
    totalDuration: number;
    averageDuration: number;
  };
}

interface RankingResponse {
  users: UserRankingData[];
  activeUsers: UserRankingData[];
  period: string;
  totalUsers: number;
  activeUserCount: number;
}

type RankingCriteria = 'totalCalls' | 'connectedCalls' | 'connectionRate' | 'totalDuration' | 'averageDuration';

const criteriaConfig: Record<RankingCriteria, { label: string; icon: React.ReactNode; description: string }> = {
  totalCalls: {
    label: '総通話数',
    icon: <Phone className="h-5 w-5" />,
    description: '発信・着信の合計数',
  },
  connectedCalls: {
    label: '接続数',
    icon: <CheckCircle className="h-5 w-5" />,
    description: '相手と繋がった通話数',
  },
  connectionRate: {
    label: '接続率',
    icon: <TrendingUp className="h-5 w-5" />,
    description: '通話が繋がった割合',
  },
  totalDuration: {
    label: '総通話時間',
    icon: <Clock className="h-5 w-5" />,
    description: '通話した合計時間',
  },
  averageDuration: {
    label: '平均通話時間',
    icon: <Clock className="h-5 w-5" />,
    description: '1通話あたりの平均時間',
  },
};

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
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}時間${mins}分`;
  }
  if (mins > 0) {
    return `${mins}分${secs}秒`;
  }
  return `${secs}秒`;
}

function formatValue(criteria: RankingCriteria, user: UserRankingData): string {
  switch (criteria) {
    case 'totalCalls':
      return `${user.summary.totalCalls.toLocaleString()}件`;
    case 'connectedCalls':
      return `${user.summary.connectedCalls.toLocaleString()}件`;
    case 'connectionRate':
      const rate = user.summary.totalCalls > 0
        ? ((user.summary.connectedCalls / user.summary.totalCalls) * 100).toFixed(1)
        : '0';
      return `${rate}%`;
    case 'totalDuration':
      return formatDuration(user.summary.totalDuration);
    case 'averageDuration':
      return formatDuration(user.summary.averageDuration);
    default:
      return '';
  }
}

function getSortValue(criteria: RankingCriteria, user: UserRankingData): number {
  switch (criteria) {
    case 'totalCalls':
      return user.summary.totalCalls;
    case 'connectedCalls':
      return user.summary.connectedCalls;
    case 'connectionRate':
      return user.summary.totalCalls > 0
        ? user.summary.connectedCalls / user.summary.totalCalls
        : 0;
    case 'totalDuration':
      return user.summary.totalDuration;
    case 'averageDuration':
      return user.summary.averageDuration;
    default:
      return 0;
  }
}

export default function RankingPage() {
  const { data: session, status } = useSession();
  const [period, setPeriod] = useState<Period>('daily');
  const [criteria, setCriteria] = useState<RankingCriteria>('totalCalls');
  const [users, setUsers] = useState<UserRankingData[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserRankingData[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const fetchData = async () => {
      if (!session) return;

      setLoading(true);
      try {
        const res = await fetch(`/api/admin/ranking?period=${period}`);
        if (res.ok) {
          const data: RankingResponse = await res.json();
          setUsers(data.users);
          setActiveUsers(data.activeUsers || data.users.filter(u => u.summary.totalCalls > 0));
        }
      } catch (error) {
        console.error('Failed to fetch ranking:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, period]);

  // ソート（0件のユーザーは下位に配置）
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const valueA = getSortValue(criteria, a);
      const valueB = getSortValue(criteria, b);
      // 両方0件の場合は名前順
      if (valueA === 0 && valueB === 0) {
        return a.name.localeCompare(b.name);
      }
      // 0件のユーザーは最後尾
      if (valueA === 0) return 1;
      if (valueB === 0) return -1;
      // 通常のソート（降順）
      return valueB - valueA;
    });
  }, [users, criteria]);

  // アクティブユーザーのみ（トップ3表示用）
  const sortedActiveUsers = useMemo(() => {
    return [...activeUsers].sort((a, b) => {
      return getSortValue(criteria, b) - getSortValue(criteria, a);
    });
  }, [activeUsers, criteria]);

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

  // トップ3を取得（通話実績があるユーザーのみ）
  const top3 = sortedActiveUsers.slice(0, 3);

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
          <PeriodTabs value={period} onChange={setPeriod} />
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

          <div className="mt-4 text-sm text-gray-500 flex items-center gap-2">
            {criteriaConfig[criteria].icon}
            <span>{criteriaConfig[criteria].description}</span>
          </div>
        </Tabs>

        {sortedActiveUsers.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>この期間の通話データがありません</p>
                <p className="text-sm mt-2">日次・週次・月次を切り替えて確認してください</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* トップ3カード（通話実績があるユーザーのみ） */}
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
                          <p className="font-medium">{user.summary.totalCalls.toLocaleString()}</p>
                          <p className="text-xs">総通話</p>
                        </div>
                        <div>
                          <p className="font-medium">{user.summary.connectedCalls.toLocaleString()}</p>
                          <p className="text-xs">接続</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

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
                    {sortedUsers.map((user, index) => {
                      const connectionRate = user.summary.totalCalls > 0
                        ? ((user.summary.connectedCalls / user.summary.totalCalls) * 100).toFixed(1)
                        : '0';

                      return (
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
                            {user.summary.totalCalls.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {user.summary.connectedCalls.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant="secondary"
                              className={
                                parseFloat(connectionRate) >= 50
                                  ? 'bg-green-100 text-green-800'
                                  : parseFloat(connectionRate) >= 30
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }
                            >
                              {connectionRate}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatDuration(user.summary.totalDuration)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatDuration(user.summary.averageDuration)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
