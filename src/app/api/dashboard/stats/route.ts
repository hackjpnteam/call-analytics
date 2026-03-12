import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongodb';
import CallLog from '@/models/CallLog';
import User from '@/models/User';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';
    const userId = searchParams.get('userId');

    const tenantId = session.user.tenantId;
    const isAdmin = session.user.role === 'admin';

    // 期間の計算
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default: // daily
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
    }

    // クエリ構築
    const query: Record<string, unknown> = {
      tenantId,
      startTime: { $gte: startDate },
    };

    if (userId || !isAdmin) {
      query.userId = userId || session.user.id;
    }

    // 期間内の通話
    const calls = await CallLog.find(query).lean();

    // デバッグログ
    console.log('Dashboard stats debug:', {
      tenantId,
      isAdmin,
      period,
      callsCount: calls.length,
    });

    // 選択期間のサマリー（メイン表示用）
    const connectedCalls = calls.filter(c => c.result === 'connected');
    const summary = {
      totalCalls: calls.length,
      connectedCalls: connectedCalls.length,
      totalDuration: calls.reduce((sum, c) => sum + (c.duration || 0), 0),
      averageDuration: connectedCalls.length > 0
        ? Math.round(connectedCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / connectedCalls.length)
        : 0,
      noAnswerCalls: calls.filter(c => c.result === 'no_answer').length,
      busyCalls: calls.filter(c => c.result === 'busy').length,
      voicemailCalls: calls.filter(c => c.result === 'voicemail').length,
      failedCalls: calls.filter(c => c.result === 'failed').length,
    };

    // periodSummaryは同じ値（互換性のため維持）
    const periodSummary = {
      totalCalls: summary.totalCalls,
      connectedCalls: summary.connectedCalls,
      totalDuration: summary.totalDuration,
      averageDuration: summary.averageDuration,
    };

    // 日別データ（期間に応じて）
    const dailyStats = [];
    const daysToShow = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayCalls = calls.filter(call => {
        const callDate = new Date(call.startTime).toISOString().split('T')[0];
        return callDate === dateStr;
      });

      dailyStats.push({
        date: dateStr,
        totalCalls: dayCalls.length,
        connectedCalls: dayCalls.filter(c => c.result === 'connected').length,
        totalDuration: dayCalls.reduce((sum, c) => sum + (c.duration || 0), 0),
      });
    }

    // 最近の通話（期間フィルターなし）
    const recentCallsQuery: Record<string, unknown> = { tenantId };
    if (userId || !isAdmin) {
      recentCallsQuery.userId = userId || session.user.id;
    }
    const recentCalls = await CallLog.find(recentCallsQuery)
      .sort({ startTime: -1 })
      .limit(15)
      .lean();

    const users = await User.find({ tenantId }).lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u.name]));

    const recentCallsWithUser = recentCalls.map(call => ({
      id: call._id.toString(),
      userId: call.userId.toString(),
      userName: userMap.get(call.userId.toString()) || '不明',
      direction: call.direction,
      phoneNumber: call.phoneNumber,
      result: call.result,
      startTime: call.startTime.toISOString(),
      duration: call.duration,
      hasRecording: call.hasRecording,
    }));

    // ユーザーランキング（管理者のみ）
    let userRanking: Array<{
      id: string;
      name: string;
      email: string;
      summary: {
        totalCalls: number;
        connectedCalls: number;
        totalDuration: number;
        averageDuration: number;
      };
      periodSummary: {
        totalCalls: number;
        connectedCalls: number;
      };
    }> = [];

    if (isAdmin) {
      const userStats = users.map((user) => {
        // 選択期間の集計（ランキング表示用）
        const periodCalls = calls.filter(
          c => c.userId.toString() === user._id.toString()
        );
        const periodConnected = periodCalls.filter(c => c.result === 'connected');

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          summary: {
            totalCalls: periodCalls.length,
            connectedCalls: periodConnected.length,
            totalDuration: periodCalls.reduce((sum, c) => sum + (c.duration || 0), 0),
            averageDuration: periodConnected.length > 0
              ? Math.round(periodConnected.reduce((sum, c) => sum + (c.duration || 0), 0) / periodConnected.length)
              : 0,
          },
          periodSummary: {
            totalCalls: periodCalls.length,
            connectedCalls: periodConnected.length,
          },
        };
      });

      // 0件ユーザーを除外してソート
      userRanking = userStats
        .filter(u => u.summary.totalCalls > 0)
        .sort((a, b) => b.summary.totalCalls - a.summary.totalCalls)
        .slice(0, 10);
    }

    // アクティブユーザー数を正確に計算
    const activeUserCount = userRanking.length;

    return NextResponse.json({
      summary,
      periodSummary,
      dailyStats,
      recentCalls: recentCallsWithUser,
      userRanking,
      activeUsers: activeUserCount,
      totalUsers: users.length,
    });
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
