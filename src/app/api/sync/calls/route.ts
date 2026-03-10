import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { CallLog, Tenant } from '@/models';
import { getAllCallLogs, mapZoomResultToInternal, ZoomApiConfig } from '@/lib/zoom-phone';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, from, to } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantIdが必要です' },
        { status: 400 }
      );
    }

    await connectDB();

    // テナントのZoom設定を取得
    const tenant = await Tenant.findById(tenantId);
    if (!tenant || !tenant.zoomPhoneConfig?.accountId) {
      return NextResponse.json(
        { error: 'Zoom Phone APIが設定されていません' },
        { status: 400 }
      );
    }

    const config: ZoomApiConfig = {
      accountId: tenant.zoomPhoneConfig.accountId,
      clientId: tenant.zoomPhoneConfig.clientId!,
      clientSecret: tenant.zoomPhoneConfig.clientSecret!,
    };

    // 日付範囲の設定（デフォルトは過去7日間）
    const toDate = to || new Date().toISOString().split('T')[0];
    const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Zoom APIから通話ログを取得
    const zoomLogs = await getAllCallLogs(config, fromDate, toDate);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // 通話ログをDBに保存
    for (const log of zoomLogs) {
      // Zoom APIのフィールド名に対応
      const callId = (log as Record<string, unknown>).call_id || (log as Record<string, unknown>).id;
      const startTime = (log as Record<string, unknown>).start_time || log.date_time;
      const callResult = (log as Record<string, unknown>).call_result || log.result;
      const calleeDid = (log as Record<string, unknown>).callee_did_number || log.callee_number;
      const callerDid = (log as Record<string, unknown>).caller_did_number || log.caller_number;
      const recordingStatus = (log as Record<string, unknown>).recording_status;

      const existingLog = await CallLog.findOne({
        tenantId: tenant._id,
        zoomCallId: callId,
      });

      if (existingLog) {
        // 既存のログを更新
        existingLog.duration = log.duration;
        existingLog.result = mapZoomResultToInternal(String(callResult));
        existingLog.hasRecording = recordingStatus === 'recorded' || log.has_recording;
        await existingLog.save();
        updated++;
      } else {
        // 新規ログを作成
        try {
          await CallLog.create({
            tenantId: tenant._id,
            userId: tenant._id,
            zoomCallId: callId,
            direction: log.direction,
            phoneNumber: log.direction === 'outbound' ? calleeDid : callerDid,
            callerName: log.caller_name,
            result: mapZoomResultToInternal(String(callResult)),
            startTime: new Date(String(startTime)),
            endTime: log.end_time ? new Date(log.end_time) : undefined,
            duration: log.duration,
            hasRecording: recordingStatus === 'recorded' || log.has_recording,
          });
          created++;
        } catch (err) {
          console.error('Failed to create call log:', err);
          skipped++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `同期完了: ${created}件作成, ${updated}件更新, ${skipped}件スキップ`,
      stats: { created, updated, skipped, total: zoomLogs.length },
    });
  } catch (error) {
    console.error('Call sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '同期エラー' },
      { status: 500 }
    );
  }
}

// 同期状態を取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantIdが必要です' },
        { status: 400 }
      );
    }

    await connectDB();

    // 最新の同期情報を取得
    const latestCall = await CallLog.findOne({ tenantId })
      .sort({ createdAt: -1 })
      .select('createdAt');

    const totalCalls = await CallLog.countDocuments({ tenantId });

    return NextResponse.json({
      lastSyncAt: latestCall?.createdAt || null,
      totalCalls,
    });
  } catch (error) {
    console.error('Get sync status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}
