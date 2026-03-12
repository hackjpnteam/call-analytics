import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongodb';
import { Tenant, CallLog, User } from '@/models';
import { getZoomAccessToken, ZoomApiConfig } from '@/lib/zoom-phone';

// 最後の同期時刻をメモリにキャッシュ（5分間隔で同期）
const syncCache = new Map<string, number>();
const SYNC_INTERVAL = 5 * 60 * 1000; // 5分

async function getUserCallLogs(token: string, userId: string, from: string, to: string): Promise<unknown[]> {
  const allLogs: unknown[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL(`https://api.zoom.us/v2/phone/users/${userId}/call_logs`);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    url.searchParams.set('page_size', '300');
    if (nextPageToken) url.searchParams.set('next_page_token', nextPageToken);

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 404 || response.status === 400) return [];
      return [];
    }

    const data = await response.json();
    allLogs.push(...(data.call_logs || []));
    nextPageToken = data.next_page_token;
  } while (nextPageToken);

  return allLogs;
}

function mapResult(zoomResult: string, duration?: number): string {
  const mapping: Record<string, string> = {
    'answered': 'connected', 'connected': 'connected', 'call_connected': 'connected',
    'no_answer': 'no_answer', 'missed': 'no_answer',
    'busy': 'busy', 'voicemail': 'voicemail',
    'failed': 'failed', 'rejected': 'failed',
    'cancelled': 'cancelled', 'abandoned': 'cancelled',
  };
  const result = mapping[zoomResult?.toLowerCase()];
  if (result) return result;
  if (duration && duration > 0) return 'connected';
  return 'failed';
}

// ページ読み込み時に自動同期
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;

    // 5分以内に同期済みならスキップ
    const lastSync = syncCache.get(tenantId);
    if (lastSync && Date.now() - lastSync < SYNC_INTERVAL) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: '最近同期済み',
        lastSyncAt: new Date(lastSync).toISOString(),
      });
    }

    await connectDB();

    const tenant = await Tenant.findById(tenantId);
    if (!tenant?.zoomPhoneConfig?.accountId) {
      return NextResponse.json({ success: false, message: 'Zoom未設定' });
    }

    const config: ZoomApiConfig = {
      accountId: tenant.zoomPhoneConfig.accountId,
      clientId: tenant.zoomPhoneConfig.clientId!,
      clientSecret: tenant.zoomPhoneConfig.clientSecret!,
    };

    // 過去2日間の通話ログを同期
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const fromDate = twoDaysAgo.toISOString().split('T')[0];
    const toDate = now.toISOString().split('T')[0];

    const token = await getZoomAccessToken(config);

    // ZoomユーザーIDを持つユーザーを取得
    const users = await User.find({
      tenantId: tenant._id,
      zoomUserId: { $exists: true, $ne: null }
    }).lean();

    let created = 0;
    let updated = 0;

    for (const user of users) {
      const logs = await getUserCallLogs(token, user.zoomUserId!, fromDate, toDate);

      for (const log of logs) {
        const logAny = log as Record<string, unknown>;
        const zoomCallId = String(logAny.call_id || logAny.id);
        const startTime = logAny.start_time || logAny.date_time;
        const callResult = String(logAny.call_result || logAny.result || '');
        const hasRecording = !!(logAny.recording_id || logAny.recording_status === 'recorded' || logAny.has_recording);

        const existing = await CallLog.findOneAndUpdate(
          { tenantId: tenant._id, zoomCallId },
          {
            $set: {
              duration: logAny.duration,
              result: mapResult(callResult, logAny.duration as number),
              hasRecording,
            }
          },
          { new: true }
        );

        if (existing) {
          updated++;
        } else {
          const direction = String(logAny.direction || 'outbound');
          await CallLog.create({
            tenantId: tenant._id,
            userId: user._id,
            zoomCallId,
            direction: direction as 'inbound' | 'outbound',
            phoneNumber: direction === 'outbound'
              ? String(logAny.callee_did_number || logAny.callee_number || '')
              : String(logAny.caller_did_number || logAny.caller_number || ''),
            callerName: String(logAny.caller_name || logAny.callee_name || ''),
            result: mapResult(callResult, logAny.duration as number),
            startTime: new Date(String(startTime)),
            endTime: logAny.end_time ? new Date(String(logAny.end_time)) : undefined,
            duration: Number(logAny.duration) || 0,
            hasRecording,
          });
          created++;
        }
      }
    }

    // キャッシュを更新
    syncCache.set(tenantId, Date.now());

    return NextResponse.json({
      success: true,
      skipped: false,
      message: `同期完了: ${created}件作成, ${updated}件更新`,
      stats: { created, updated },
    });
  } catch (error) {
    console.error('Auto sync error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '同期エラー' },
      { status: 500 }
    );
  }
}
