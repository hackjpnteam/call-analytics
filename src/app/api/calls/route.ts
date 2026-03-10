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
    const search = searchParams.get('search') || '';
    const result = searchParams.get('result') || 'all';
    const direction = searchParams.get('direction') || 'all';
    const hasRecording = searchParams.get('hasRecording') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100');
    const page = parseInt(searchParams.get('page') || '1');
    const sortBy = searchParams.get('sortBy') || 'startTime';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // クエリ構築
    const query: Record<string, unknown> = {
      tenantId: session.user.tenantId,
    };

    // 管理者以外は自分の通話のみ
    if (session.user.role !== 'admin') {
      query.userId = session.user.id;
    }

    if (search) {
      query.phoneNumber = { $regex: search.replace(/-/g, ''), $options: 'i' };
    }

    if (result !== 'all') {
      query.result = result;
    }

    if (direction !== 'all') {
      query.direction = direction;
    }

    if (hasRecording === 'true') {
      query.hasRecording = true;
      query.recordingId = { $exists: true, $ne: null };
    } else if (hasRecording === 'false') {
      query.$or = [
        { hasRecording: false },
        { hasRecording: { $exists: false } },
        { recordingId: { $exists: false } },
        { recordingId: null },
      ];
    }

    const skip = (page - 1) * limit;

    // ソート設定
    const allowedSortFields = ['startTime', 'duration', 'result'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'startTime';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [calls, total, users] = await Promise.all([
      CallLog.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      CallLog.countDocuments(query),
      User.find({ tenantId: session.user.tenantId }).lean(),
    ]);

    // ユーザー名マッピング
    const userMap = new Map(users.map(u => [u._id.toString(), u.name]));

    const callsWithUser = calls.map(call => ({
      id: call._id.toString(),
      userId: call.userId.toString(),
      userName: userMap.get(call.userId.toString()) || '不明',
      direction: call.direction,
      phoneNumber: call.phoneNumber,
      result: call.result,
      startTime: call.startTime.toISOString(),
      endTime: call.endTime?.toISOString(),
      duration: call.duration,
      hasRecording: call.hasRecording,
      recordingId: call.recordingId?.toString(),
    }));

    return NextResponse.json({
      calls: callsWithUser,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Failed to fetch calls:', error);
    return NextResponse.json({ error: 'Failed to fetch calls' }, { status: 500 });
  }
}
