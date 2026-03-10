import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db/mongodb';
import Tenant from '@/models/Tenant';
import User from '@/models/User';
import CallLog from '@/models/CallLog';
import { filemakerClient, CallLogData } from '@/lib/filemaker';

// 通話結果をFileMaker用に変換
function mapCallResult(result: string): string {
  const mapping: Record<string, string> = {
    connected: '接続',
    no_answer: '不在',
    busy: '話中',
    voicemail: '留守電',
    failed: '失敗',
    cancelled: 'キャンセル',
  };
  return mapping[result] || result;
}

// 通話ログをFileMakerにエクスポート
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant || !tenant.fileMakerConfig?.host) {
      return NextResponse.json({ error: 'FileMaker not configured' }, { status: 400 });
    }

    const body = await request.json();
    const { startDate, endDate, onlyUnsynced } = body;

    // FileMakerクライアント設定
    filemakerClient.setConfig({
      host: tenant.fileMakerConfig.host,
      database: tenant.fileMakerConfig.database!,
      username: tenant.fileMakerConfig.username!,
      password: tenant.fileMakerConfig.password!,
      customerLayout: tenant.fileMakerConfig.customerLayout!,
      callLogLayout: tenant.fileMakerConfig.callLogLayout!,
    });

    // 対象の通話ログを取得
    const query: Record<string, unknown> = { tenantId: user.tenantId };

    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) (query.startTime as Record<string, Date>).$gte = new Date(startDate);
      if (endDate) (query.startTime as Record<string, Date>).$lte = new Date(endDate);
    }

    if (onlyUnsynced) {
      query.fileMakerSynced = { $ne: true };
    }

    const callLogs = await CallLog.find(query)
      .populate('userId', 'name')
      .sort({ startTime: -1 })
      .limit(500);

    let exported = 0;
    let errors = 0;

    for (const log of callLogs) {
      try {
        const callLogData: CallLogData = {
          通話ID: log._id.toString(),
          顧客ID: log.customerId || '',
          電話番号: log.phoneNumber,
          担当者: (log.userId as { name?: string })?.name || '',
          通話開始日時: log.startTime.toISOString(),
          通話終了日時: log.endTime?.toISOString() || '',
          通話時間: log.duration,
          通話結果: mapCallResult(log.result),
          メモ: log.notes || '',
        };

        await filemakerClient.createCallLog(callLogData);

        // 同期済みフラグを更新
        await CallLog.findByIdAndUpdate(log._id, {
          fileMakerSynced: true,
          fileMakerSyncedAt: new Date(),
        });

        exported++;
      } catch (error) {
        console.error('Call log export error:', error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total: callLogs.length,
        exported,
        errors,
      },
    });
  } catch (error) {
    console.error('Call log sync error:', error);
    return NextResponse.json(
      { error: 'Failed to export call logs' },
      { status: 500 }
    );
  }
}
