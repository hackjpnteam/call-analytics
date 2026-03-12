import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongodb';
import { Tenant, CallLog, User } from '@/models';
import { getZoomAccessToken, ZoomApiConfig } from '@/lib/zoom-phone';

// 最後の同期時刻をメモリにキャッシュ（5分間隔で同期）
const syncCache = new Map<string, number>();
const SYNC_INTERVAL = 5 * 60 * 1000; // 5分

interface ZoomCallLog {
  id?: string;
  call_id?: string;
  date_time?: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
  direction?: string;
  result?: string;
  call_result?: string;
  caller_number?: string;
  caller_did_number?: string;
  caller_name?: string;
  callee_number?: string;
  callee_did_number?: string;
  callee_name?: string;
  recording_id?: string;
  recording_status?: string;
  has_recording?: boolean;
  owner?: {
    id?: string;
    name?: string;
    type?: string;
  };
}

async function getAccountCallLogs(token: string, from: string, to: string): Promise<ZoomCallLog[]> {
  const allLogs: ZoomCallLog[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL('https://api.zoom.us/v2/phone/call_logs');
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    url.searchParams.set('page_size', '300');
    if (nextPageToken) url.searchParams.set('next_page_token', nextPageToken);

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      console.error('Zoom API error:', response.status, await response.text());
      break;
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
export async function POST() {
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

    // ZoomユーザーIDからDBユーザーIDへのマップを作成
    const users = await User.find({
      tenantId: tenant._id,
      zoomUserId: { $exists: true, $ne: null }
    }).lean();

    const zoomUserMap = new Map<string, string>();
    for (const user of users) {
      if (user.zoomUserId) {
        zoomUserMap.set(user.zoomUserId, user._id.toString());
      }
    }

    // アカウント全体の通話ログを取得
    const logs = await getAccountCallLogs(token, fromDate, toDate);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const log of logs) {
      const zoomCallId = String(log.call_id || log.id);
      const startTime = log.start_time || log.date_time;
      const callResult = String(log.call_result || log.result || '');
      const hasRecording = !!(log.recording_id || log.recording_status === 'recorded' || log.has_recording);

      // オーナーからユーザーIDを取得
      const ownerZoomId = log.owner?.id;
      const userId = ownerZoomId ? zoomUserMap.get(ownerZoomId) : null;

      if (!userId) {
        skipped++;
        continue;
      }

      const existing = await CallLog.findOneAndUpdate(
        { tenantId: tenant._id, zoomCallId },
        {
          $set: {
            duration: log.duration,
            result: mapResult(callResult, log.duration),
            hasRecording,
          }
        },
        { new: true }
      );

      if (existing) {
        updated++;
      } else {
        const direction = String(log.direction || 'outbound');
        await CallLog.create({
          tenantId: tenant._id,
          userId,
          zoomCallId,
          direction: direction as 'inbound' | 'outbound',
          phoneNumber: direction === 'outbound'
            ? String(log.callee_did_number || log.callee_number || '')
            : String(log.caller_did_number || log.caller_number || ''),
          callerName: String(log.caller_name || log.callee_name || ''),
          result: mapResult(callResult, log.duration),
          startTime: new Date(String(startTime)),
          endTime: log.end_time ? new Date(String(log.end_time)) : undefined,
          duration: Number(log.duration) || 0,
          hasRecording,
        });
        created++;
      }
    }

    // キャッシュを更新
    syncCache.set(tenantId, Date.now());

    return NextResponse.json({
      success: true,
      skipped: false,
      message: `同期完了: ${created}件作成, ${updated}件更新, ${skipped}件スキップ`,
      stats: { created, updated, skipped, total: logs.length },
    });
  } catch (error) {
    console.error('Auto sync error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '同期エラー' },
      { status: 500 }
    );
  }
}
