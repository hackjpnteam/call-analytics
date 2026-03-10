import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongodb';
import User from '@/models/User';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const tenantId = session.user.tenantId;

    // 全ユーザー取得
    const users = await User.find({ tenantId, isActive: true }).lean();

    // Zoom連携統計
    const linkedUsers = users.filter(u => u.zoomUserId);
    const activePhoneUsers = users.filter(u => u.zoomPhoneStatus === 'activate');

    // プラン別集計
    const planCounts: Record<string, number> = {};
    linkedUsers.forEach(u => {
      const plans = (u.zoomCallingPlans as string[]) || [];
      if (plans.length === 0) {
        planCounts['プランなし'] = (planCounts['プランなし'] || 0) + 1;
      } else {
        plans.forEach(plan => {
          planCounts[plan] = (planCounts[plan] || 0) + 1;
        });
      }
    });

    // サイト別集計
    const siteCounts: Record<string, number> = {};
    linkedUsers.forEach(u => {
      const site = (u.zoomSiteName as string) || '未設定';
      siteCounts[site] = (siteCounts[site] || 0) + 1;
    });

    // 内線番号あり
    const withExtension = linkedUsers.filter(u => u.zoomExtensionNumber).length;
    const withPhoneNumber = linkedUsers.filter(u => u.zoomPhoneNumber).length;

    return NextResponse.json({
      totalUsers: users.length,
      linkedUsers: linkedUsers.length,
      activePhoneUsers: activePhoneUsers.length,
      withExtension,
      withPhoneNumber,
      planCounts,
      siteCounts,
      linkRate: users.length > 0
        ? Math.round((linkedUsers.length / users.length) * 100)
        : 0,
    });
  } catch (error) {
    console.error('Failed to fetch Zoom stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
