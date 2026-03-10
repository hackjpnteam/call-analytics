import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongodb';
import CallLog from '@/models/CallLog';
import User from '@/models/User';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'daily';

    const tenantId = new mongoose.Types.ObjectId(session.user.tenantId);

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

    // MongoDB Aggregation で効率的に集計
    const stats = await CallLog.aggregate([
      {
        $match: {
          tenantId,
          startTime: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$userId',
          totalCalls: { $sum: 1 },
          connectedCalls: {
            $sum: { $cond: [{ $eq: ['$result', 'connected'] }, 1, 0] },
          },
          totalDuration: { $sum: { $ifNull: ['$duration', 0] } },
          connectedDuration: {
            $sum: {
              $cond: [
                { $eq: ['$result', 'connected'] },
                { $ifNull: ['$duration', 0] },
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          id: { $toString: '$_id' },
          name: '$user.name',
          email: '$user.email',
          summary: {
            totalCalls: '$totalCalls',
            connectedCalls: '$connectedCalls',
            totalDuration: '$totalDuration',
            averageDuration: {
              $cond: [
                { $gt: ['$connectedCalls', 0] },
                { $round: [{ $divide: ['$connectedDuration', '$connectedCalls'] }, 0] },
                0,
              ],
            },
          },
        },
      },
      {
        $sort: { 'summary.totalCalls': -1 },
      },
    ]);

    // ユーザー一覧も取得（通話がないユーザーも含める）
    const users = await User.find({ tenantId, isActive: true }).lean();
    const statsMap = new Map(stats.map(s => [s.id, s]));

    const allUsers = users.map(user => {
      const userId = user._id.toString();
      const existing = statsMap.get(userId);
      if (existing) {
        return existing;
      }
      return {
        id: userId,
        name: user.name,
        email: user.email,
        summary: {
          totalCalls: 0,
          connectedCalls: 0,
          totalDuration: 0,
          averageDuration: 0,
        },
      };
    });

    // ソート
    allUsers.sort((a, b) => b.summary.totalCalls - a.summary.totalCalls);

    return NextResponse.json({
      users: allUsers,
      period,
      totalUsers: users.length,
    });
  } catch (error) {
    console.error('Failed to fetch ranking:', error);
    return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 });
  }
}
