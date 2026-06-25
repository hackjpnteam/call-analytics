import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongodb';
import CallLog from '@/models/CallLog';
import User from '@/models/User';
import { getLiveZoomCalls, summarizeCalls } from '@/lib/zoom-live-calls';

async function getZoomAnalytics(period: string) {
  const calls = await getLiveZoomCalls(period, 20);

  const hourlyData = Array.from({ length: 10 }, (_, i) => ({
    hour: `${i + 9}時`,
    totalCalls: 0,
    connectedCalls: 0,
  }));

  calls.forEach((call) => {
    const hour = new Date(call.startTime).getHours();
    if (hour >= 9 && hour < 19) {
      hourlyData[hour - 9].totalCalls++;
      if (call.result === 'connected') hourlyData[hour - 9].connectedCalls++;
    }
  });

  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dayOfWeekData = days.map((day) => ({
    day,
    totalCalls: 0,
    connectedCalls: 0,
    connectionRate: 0,
  }));

  calls.forEach((call) => {
    const dayIndex = new Date(call.startTime).getDay();
    dayOfWeekData[dayIndex].totalCalls++;
    if (call.result === 'connected') dayOfWeekData[dayIndex].connectedCalls++;
  });
  dayOfWeekData.forEach((day) => {
    day.connectionRate = day.totalCalls > 0
      ? Math.round((day.connectedCalls / day.totalCalls) * 100)
      : 0;
  });

  const resultBreakdown = [
    { name: '接続', value: calls.filter(c => c.result === 'connected').length, color: '#22c55e' },
    { name: '不在', value: calls.filter(c => c.result === 'no_answer').length, color: '#f59e0b' },
    { name: '話中', value: calls.filter(c => c.result === 'busy').length, color: '#ef4444' },
    { name: '留守電', value: calls.filter(c => c.result === 'voicemail').length, color: '#8b5cf6' },
    { name: '失敗', value: calls.filter(c => c.result === 'failed').length, color: '#6b7280' },
  ];

  const userMap = new Map<string, typeof calls>();
  for (const call of calls) {
    const key = call.userId || call.userName;
    userMap.set(key, [...(userMap.get(key) || []), call]);
  }

  const userPerformance = Array.from(userMap.values())
    .map((userCalls) => {
      const first = userCalls[0];
      const summary = summarizeCalls(userCalls);
      return {
        name: first.userName,
        totalCalls: summary.totalCalls,
        connectedCalls: summary.connectedCalls,
        connectionRate: summary.totalCalls > 0
          ? Math.round((summary.connectedCalls / summary.totalCalls) * 100)
          : 0,
        avgDuration: Math.round(summary.averageDuration / 60),
        totalDuration: Math.round(summary.totalDuration / 60),
      };
    })
    .filter(user => user.totalCalls > 0)
    .sort((a, b) => b.totalCalls - a.totalCalls);

  const now = new Date();
  const daysToShow = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
  const dailyStats = Array.from({ length: daysToShow }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (daysToShow - 1 - index));
    const dateStr = date.toISOString().split('T')[0];
    const dayCalls = calls.filter(call => call.startTime.split('T')[0] === dateStr);

    return {
      date: dateStr,
      totalCalls: dayCalls.length,
      connectedCalls: dayCalls.filter(call => call.result === 'connected').length,
      totalDuration: dayCalls.reduce((sum, call) => sum + call.duration, 0),
    };
  });

  const summary = summarizeCalls(calls);
  const totalSummary = {
    totalCalls: summary.totalCalls,
    connectedCalls: summary.connectedCalls,
    totalDuration: summary.totalDuration,
    averageDuration: summary.averageDuration,
  };

  const splitIndex = Math.floor(dailyStats.length / 2);
  const previousStats = dailyStats.slice(0, splitIndex);
  const currentStats = dailyStats.slice(splitIndex);
  const currentPeriodCalls = currentStats.reduce((sum, day) => sum + day.totalCalls, 0);
  const currentPeriodConnected = currentStats.reduce((sum, day) => sum + day.connectedCalls, 0);
  const previousPeriodCalls = previousStats.reduce((sum, day) => sum + day.totalCalls, 0);
  const previousPeriodConnected = previousStats.reduce((sum, day) => sum + day.connectedCalls, 0);

  return {
    hourlyStats: hourlyData,
    dayOfWeekStats: dayOfWeekData,
    resultBreakdown,
    userPerformance,
    dailyStats,
    totalSummary,
    comparison: {
      current: { totalCalls: currentPeriodCalls, connectedCalls: currentPeriodConnected },
      previous: { totalCalls: previousPeriodCalls, connectedCalls: previousPeriodConnected },
      callsChange: previousPeriodCalls > 0
        ? Math.round(((currentPeriodCalls - previousPeriodCalls) / previousPeriodCalls) * 100)
        : 0,
      connectedChange: previousPeriodConnected > 0
        ? Math.round(((currentPeriodConnected - previousPeriodConnected) / previousPeriodConnected) * 100)
        : 0,
    },
    source: 'zoom',
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';

    await connectDB();

    const tenantId = session.user.tenantId;

    // 全通話データ取得（過去30日）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const calls = await CallLog.find({
      tenantId,
      startTime: { $gte: thirtyDaysAgo },
    }).lean();

    const users = await User.find({ tenantId }).lean();

    // 時間帯別データ（9-18時）
    const hourlyData = Array.from({ length: 10 }, (_, i) => ({
      hour: `${i + 9}時`,
      totalCalls: 0,
      connectedCalls: 0,
    }));

    calls.forEach((call) => {
      const hour = new Date(call.startTime).getHours();
      if (hour >= 9 && hour < 19) {
        hourlyData[hour - 9].totalCalls++;
        if (call.result === 'connected') {
          hourlyData[hour - 9].connectedCalls++;
        }
      }
    });

    // 曜日別データ
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeekData = days.map((day) => ({
      day,
      totalCalls: 0,
      connectedCalls: 0,
      connectionRate: 0,
    }));

    calls.forEach((call) => {
      const dayIndex = new Date(call.startTime).getDay();
      dayOfWeekData[dayIndex].totalCalls++;
      if (call.result === 'connected') {
        dayOfWeekData[dayIndex].connectedCalls++;
      }
    });

    dayOfWeekData.forEach((d) => {
      d.connectionRate = d.totalCalls > 0
        ? Math.round((d.connectedCalls / d.totalCalls) * 100)
        : 0;
    });

    // 結果内訳
    const resultBreakdown = [
      { name: '接続', value: calls.filter(c => c.result === 'connected').length, color: '#22c55e' },
      { name: '不在', value: calls.filter(c => c.result === 'no_answer').length, color: '#f59e0b' },
      { name: '話中', value: calls.filter(c => c.result === 'busy').length, color: '#ef4444' },
      { name: '留守電', value: calls.filter(c => c.result === 'voicemail').length, color: '#8b5cf6' },
      { name: '失敗', value: calls.filter(c => c.result === 'failed').length, color: '#6b7280' },
    ];

    // ユーザー別パフォーマンス
    const userPerformance = users.map((user) => {
      const userCalls = calls.filter(c => c.userId.toString() === user._id.toString());
      const connected = userCalls.filter(c => c.result === 'connected');
      const totalDuration = userCalls.reduce((sum, c) => sum + (c.duration || 0), 0);
      const avgDuration = connected.length > 0
        ? Math.round(connected.reduce((sum, c) => sum + (c.duration || 0), 0) / connected.length)
        : 0;

      return {
        name: user.name,
        totalCalls: userCalls.length,
        connectedCalls: connected.length,
        connectionRate: userCalls.length > 0
          ? Math.round((connected.length / userCalls.length) * 100)
          : 0,
        avgDuration: Math.round(avgDuration / 60),
        totalDuration: Math.round(totalDuration / 60),
      };
    }).filter(u => u.totalCalls > 0).sort((a, b) => b.connectedCalls - a.connectedCalls);

    // 日別トレンド（過去30日）
    const dailyStats = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
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

    // サマリー
    const connectedCalls = calls.filter(c => c.result === 'connected');
    const totalSummary = {
      totalCalls: calls.length,
      connectedCalls: connectedCalls.length,
      totalDuration: calls.reduce((sum, c) => sum + (c.duration || 0), 0),
      averageDuration: connectedCalls.length > 0
        ? Math.round(connectedCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / connectedCalls.length)
        : 0,
    };

    // 前期比較
    const currentPeriodCalls = dailyStats.slice(-7).reduce((sum, d) => sum + d.totalCalls, 0);
    const currentPeriodConnected = dailyStats.slice(-7).reduce((sum, d) => sum + d.connectedCalls, 0);
    const previousPeriodCalls = dailyStats.slice(-14, -7).reduce((sum, d) => sum + d.totalCalls, 0);
    const previousPeriodConnected = dailyStats.slice(-14, -7).reduce((sum, d) => sum + d.connectedCalls, 0);

    const comparison = {
      current: { totalCalls: currentPeriodCalls, connectedCalls: currentPeriodConnected },
      previous: { totalCalls: previousPeriodCalls, connectedCalls: previousPeriodConnected },
      callsChange: previousPeriodCalls > 0
        ? Math.round(((currentPeriodCalls - previousPeriodCalls) / previousPeriodCalls) * 100)
        : 0,
      connectedChange: previousPeriodConnected > 0
        ? Math.round(((currentPeriodConnected - previousPeriodConnected) / previousPeriodConnected) * 100)
        : 0,
    };

    return NextResponse.json({
      hourlyStats: hourlyData,
      dayOfWeekStats: dayOfWeekData,
      resultBreakdown,
      userPerformance,
      dailyStats,
      totalSummary,
      comparison,
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    try {
      const { searchParams } = new URL(request.url);
      return NextResponse.json(await getZoomAnalytics(searchParams.get('period') || 'daily'));
    } catch (zoomError) {
      console.error('Failed to fetch Zoom analytics:', zoomError);
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
  }
}
