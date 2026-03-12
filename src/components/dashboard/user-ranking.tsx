'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Award } from 'lucide-react';

interface UserWithSummary {
  id: string;
  name: string;
  email: string;
  summary: {
    totalCalls: number;
    connectedCalls: number;
    totalDuration: number;
    averageDuration: number;
  };
  periodSummary?: {
    totalCalls: number;
    connectedCalls: number;
  };
}

type RankingCriteria = 'totalCalls' | 'connectedCalls' | 'connectionRate' | 'totalDuration' | 'averageDuration';

interface UserRankingProps {
  users: UserWithSummary[];
}

const criteriaLabels: Record<RankingCriteria, string> = {
  totalCalls: '総通話数',
  connectedCalls: '接続数',
  connectionRate: '接続率',
  totalDuration: '総通話時間',
  averageDuration: '平均通話時間',
};

function getRankIcon(rank: number) {
  switch (rank) {
    case 1:
      return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />;
    case 3:
      return <Award className="h-5 w-5 text-amber-600" />;
    default:
      return <span className="text-gray-500 font-medium">{rank}</span>;
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

function formatValue(criteria: RankingCriteria, user: UserWithSummary): string {
  switch (criteria) {
    case 'totalCalls':
      return `${user.summary.totalCalls}件`;
    case 'connectedCalls':
      return `${user.summary.connectedCalls}件`;
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

function getSortValue(criteria: RankingCriteria, user: UserWithSummary): number {
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

export function UserRanking({ users }: UserRankingProps) {
  const [criteria, setCriteria] = useState<RankingCriteria>('totalCalls');

  // 0件のユーザーを除外してソート
  const sortedUsers = useMemo(() => {
    const activeUsers = users.filter(u => u.summary.totalCalls > 0);
    return activeUsers.sort((a, b) => {
      const valueA = getSortValue(criteria, a);
      const valueB = getSortValue(criteria, b);
      if (valueA === 0 && valueB === 0) return a.name.localeCompare(b.name);
      if (valueA === 0) return 1;
      if (valueB === 0) return -1;
      return valueB - valueA;
    });
  }, [users, criteria]);

  if (sortedUsers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">オペレーターランキング</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500 py-8">この期間の通話データがありません</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">オペレーターランキング</CardTitle>
        <Select value={criteria} onValueChange={(v) => setCriteria(v as RankingCriteria)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="totalCalls">総通話数</SelectItem>
            <SelectItem value="connectedCalls">接続数</SelectItem>
            <SelectItem value="connectionRate">接続率</SelectItem>
            <SelectItem value="totalDuration">総通話時間</SelectItem>
            <SelectItem value="averageDuration">平均通話時間</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedUsers.map((user, index) => {
            return (
              <div
                key={user.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-gray-50"
              >
                <div className="flex items-center justify-center w-8">
                  {getRankIcon(index + 1)}
                </div>
                <div className="relative">
                  <Avatar>
                    <AvatarFallback className="bg-blue-100 text-blue-700">
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{user.name}</p>
                  <p className="text-sm text-gray-500 truncate">{user.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">
                    {formatValue(criteria, user)}
                  </p>
                  <div className="flex gap-2 text-xs text-gray-500">
                    {criteria !== 'totalCalls' && (
                      <span>{user.summary.totalCalls}件</span>
                    )}
                    {criteria !== 'connectedCalls' && criteria !== 'totalCalls' && (
                      <span>接続{user.summary.connectedCalls}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
