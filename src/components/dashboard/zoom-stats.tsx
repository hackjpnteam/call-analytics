'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Link2, Users, Hash } from 'lucide-react';

interface ZoomStats {
  totalUsers: number;
  linkedUsers: number;
  activePhoneUsers: number;
  withExtension: number;
  withPhoneNumber: number;
  planCounts: Record<string, number>;
  siteCounts: Record<string, number>;
  linkRate: number;
}

export function ZoomStatsCard() {
  const [stats, setStats] = useState<ZoomStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/zoom/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch Zoom stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Zoom Phone 統計
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Zoom Phone 統計
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 連携状況 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">総ユーザー</p>
              <p className="text-lg font-semibold">{stats.totalUsers}名</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Link2 className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Zoom連携</p>
              <p className="text-lg font-semibold">{stats.linkedUsers}名 ({stats.linkRate}%)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Phone className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">電話番号あり</p>
              <p className="text-lg font-semibold">{stats.withPhoneNumber}名</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Hash className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">内線あり</p>
              <p className="text-lg font-semibold">{stats.withExtension}名</p>
            </div>
          </div>
        </div>

        {/* プラン別 */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">契約プラン</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.planCounts).map(([plan, count]) => (
              <Badge key={plan} variant="secondary" className="text-xs">
                {plan.replace('JP ', '').replace(' Plan', '')}: {count}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
