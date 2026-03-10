import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db/mongodb';
import Tenant from '@/models/Tenant';
import User from '@/models/User';

// 設定取得
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // ユーザーからテナントIDを取得
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({
      settings: tenant.settings,
    });
  } catch (error) {
    console.error('Error getting settings:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

// 設定保存
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // ユーザーからテナントIDを取得
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 管理者権限チェック
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { workStartTime, workEndTime, breakDuration, recordingRetentionDays } = body;

    // バリデーション
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (workStartTime && !timeRegex.test(workStartTime)) {
      return NextResponse.json(
        { error: 'Invalid work start time format' },
        { status: 400 }
      );
    }
    if (workEndTime && !timeRegex.test(workEndTime)) {
      return NextResponse.json(
        { error: 'Invalid work end time format' },
        { status: 400 }
      );
    }

    // 更新オブジェクト構築
    const updateFields: Record<string, unknown> = {};
    if (workStartTime !== undefined) {
      updateFields['settings.workStartTime'] = workStartTime;
    }
    if (workEndTime !== undefined) {
      updateFields['settings.workEndTime'] = workEndTime;
    }
    if (breakDuration !== undefined) {
      const breakMins = parseInt(breakDuration, 10);
      if (isNaN(breakMins) || breakMins < 0 || breakMins > 480) {
        return NextResponse.json(
          { error: 'Invalid break duration' },
          { status: 400 }
        );
      }
      updateFields['settings.breakDuration'] = breakMins;
    }
    if (recordingRetentionDays !== undefined) {
      if (recordingRetentionDays === 'unlimited') {
        updateFields['settings.recordingRetentionDays'] = -1;
      } else {
        const days = parseInt(recordingRetentionDays, 10);
        if (isNaN(days) || days < 1) {
          return NextResponse.json(
            { error: 'Invalid retention days' },
            { status: 400 }
          );
        }
        updateFields['settings.recordingRetentionDays'] = days;
      }
    }

    const tenant = await Tenant.findByIdAndUpdate(
      user.tenantId,
      { $set: updateFields },
      { new: true }
    );

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      settings: tenant.settings,
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
