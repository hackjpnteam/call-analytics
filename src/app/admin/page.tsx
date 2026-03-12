'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import {
  DashboardLayout,
  StatsCard,
  CallResultChart,
  DailyChart,
  CallList,
  ZoomStatsCard,
} from '@/components/dashboard';
import { UserRanking } from '@/components/dashboard/user-ranking';
import { PeriodTabs, Period } from '@/components/dashboard/period-tabs';
import { Phone, Clock, CheckCircle, Users } from 'lucide-react';
import { FullPageLoading } from '@/components/ui/loading-spinner';
import { CallResult } from '@/types';

interface DashboardData {
  summary: {
    totalCalls: number;
    connectedCalls: number;
    totalDuration: number;
    averageDuration: number;
    noAnswerCalls: number;
    busyCalls: number;
    voicemailCalls: number;
    failedCalls: number;
  };
  dailyStats: Array<{
    date: string;
    totalCalls: number;
    connectedCalls: number;
    totalDuration: number;
  }>;
  recentCalls: Array<{
    id: string;
    userId: string;
    userName: string;
    direction: 'inbound' | 'outbound';
    phoneNumber: string;
    result: CallResult;
    startTime: string;
    duration: number;
    hasRecording: boolean;
  }>;
  userRanking: Array<{
    id: string;
    name: string;
    email: string;
    summary: {
      totalCalls: number;
      connectedCalls: number;
      totalDuration: number;
      averageDuration: number;
    };
  }>;
  activeUsers: number;
  totalUsers: number;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}時間${mins}分`;
  }
  return `${mins}分`;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const [period, setPeriod] = useState<Period>('daily');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!session) return;

      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/stats?period=${period}`);
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, period]);

  if (status === 'loading' || loading) {
    return <FullPageLoading />;
  }

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'admin') {
    redirect('/');
  }

  const baseSummary = data?.summary || {
    totalCalls: 0,
    connectedCalls: 0,
    totalDuration: 0,
    averageDuration: 0,
    noAnswerCalls: 0,
    busyCalls: 0,
    voicemailCalls: 0,
    failedCalls: 0,
  };

  // idleTimeを計算（期間に応じた勤務時間）
  const workHoursPerDay = 7;
  const workDays = {
    daily: 1,
    weekly: 5,
    monthly: 22,
  };
  const workSeconds = workHoursPerDay * 60 * 60 * workDays[period];
  const summary = {
    ...baseSummary,
    idleTime: Math.max(0, workSeconds - baseSummary.totalDuration),
  };

  const connectionRate =
    summary.totalCalls > 0
      ? ((summary.connectedCalls / summary.totalCalls) * 100).toFixed(1)
      : '0';

  const periodLabels = {
    daily: '今日',
    weekly: '今週',
    monthly: '今月',
  };

  return (
    <DashboardLayout
      userRole={session.user.role}
      userName={session.user.name}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">管理者ダッシュボード</h1>
            <p className="text-gray-600">チーム全体の{periodLabels[period]}の架電実績</p>
          </div>
          <PeriodTabs value={period} onChange={setPeriod} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="総通話数"
            value={summary.totalCalls}
            subtitle="全期間の総発信数"
            icon={Phone}
          />
          <StatsCard
            title="総接続数"
            value={summary.connectedCalls}
            subtitle={`接続率 ${connectionRate}%`}
            icon={CheckCircle}
          />
          <StatsCard
            title="総通話時間"
            value={formatDuration(summary.totalDuration)}
            subtitle={`平均 ${formatDuration(summary.averageDuration)}`}
            icon={Clock}
          />
          <StatsCard
            title="アクティブユーザー"
            value={data?.activeUsers || 0}
            subtitle={`全 ${data?.totalUsers || 0} 名中`}
            icon={Users}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DailyChart data={data?.dailyStats || []} />
          </div>
          <div>
            <CallResultChart summary={summary} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <UserRanking users={data?.userRanking || []} />
          <CallList
            calls={data?.recentCalls || []}
            showUser
          />
          <ZoomStatsCard />
        </div>
      </div>
    </DashboardLayout>
  );
}
