import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { Tenant, CallLog, Recording, User } from '@/models';
import { ZoomApiConfig, getZoomAccessToken } from '@/lib/zoom-phone';

// Vercel Cronの認証用シークレット
const CRON_SECRET = process.env.CRON_SECRET;

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

  // If duration > 0, the call was connected regardless of result string
  if (duration && duration > 0) {
    return 'connected';
  }

  return 'failed';
}

async function getUserCallLogs(token: string, userId: string, from: string, to: string): Promise<any[]> {
  const allLogs: any[] = [];
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

// バッチ同期処理
// Vercel Cronから定期的に呼び出される（5分間隔）
export async function GET(request: NextRequest) {
  try {
    // Cron認証チェック（本番環境用）- 開発時はスキップ
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && CRON_SECRET !== 'your-cron-secret' && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Zoom設定があるすべてのテナントを取得
    const tenants = await Tenant.find({
      'zoomPhoneConfig.accountId': { $exists: true, $ne: '' },
      'zoomPhoneConfig.clientId': { $exists: true, $ne: '' },
      'zoomPhoneConfig.clientSecret': { $exists: true, $ne: '' },
    });

    const results = [];

    for (const tenant of tenants) {
      try {
        const config: ZoomApiConfig = {
          accountId: tenant.zoomPhoneConfig!.accountId!,
          clientId: tenant.zoomPhoneConfig!.clientId!,
          clientSecret: tenant.zoomPhoneConfig!.clientSecret!,
        };

        // 過去2日間の通話ログを同期
        const now = new Date();
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        const fromDate = twoDaysAgo.toISOString().split('T')[0];
        const toDate = now.toISOString().split('T')[0];

        // Get access token
        const token = await getZoomAccessToken(config);

        // Get users with Zoom IDs
        const users = await User.find({
          tenantId: tenant._id,
          zoomUserId: { $exists: true, $ne: null }
        }).lean();

        let callsCreated = 0;
        let callsUpdated = 0;

        // Fetch call logs per user
        for (const user of users) {
          const logs = await getUserCallLogs(token, user.zoomUserId!, fromDate, toDate);

          for (const log of logs) {
            const zoomCallId = log.call_id || log.id;
            const startTime = log.start_time || log.date_time;
            const callResult = log.call_result || log.result;

            // Check for recording via recording_id field
            const hasRecording = !!(log.recording_id || log.recording_status === 'recorded' || log.has_recording);

            const existing = await CallLog.findOneAndUpdate(
              { tenantId: tenant._id, zoomCallId: zoomCallId },
              {
                $set: {
                  duration: log.duration,
                  result: mapResult(callResult, log.duration),
                  hasRecording: hasRecording,
                  ...(log.recording_id && { zoomRecordingId: log.recording_id }),
                }
              },
              { new: true }
            );

            if (existing) {
              callsUpdated++;

              // Create recording record if needed
              if (log.recording_id && !existing.recordingId) {
                const existingRec = await Recording.findOne({
                  tenantId: tenant._id,
                  zoomRecordingId: log.recording_id,
                });

                if (!existingRec) {
                  const expiresAt = new Date();
                  expiresAt.setDate(expiresAt.getDate() + 180);

                  const recording = await Recording.create({
                    tenantId: tenant._id,
                    callLogId: existing._id,
                    userId: user._id,
                    zoomRecordingId: log.recording_id,
                    duration: log.duration,
                    recordingType: log.recording_type,
                    mimeType: 'audio/mp3',
                    expiresAt,
                  });

                  existing.recordingId = recording._id;
                  await existing.save();
                }
              }
            } else {
              const callLog = await CallLog.create({
                tenantId: tenant._id,
                userId: user._id,
                zoomCallId: zoomCallId,
                direction: log.direction,
                phoneNumber: log.direction === 'outbound'
                  ? (log.callee_did_number || log.callee_number || '')
                  : (log.caller_did_number || log.caller_number || ''),
                callerName: log.caller_name || log.callee_name,
                result: mapResult(callResult, log.duration),
                startTime: new Date(startTime),
                endTime: log.end_time ? new Date(log.end_time) : undefined,
                duration: log.duration || 0,
                hasRecording: hasRecording,
                zoomRecordingId: log.recording_id,
              });
              callsCreated++;

              // Create recording record if needed
              if (log.recording_id) {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 180);

                const recording = await Recording.create({
                  tenantId: tenant._id,
                  callLogId: callLog._id,
                  userId: user._id,
                  zoomRecordingId: log.recording_id,
                  duration: log.duration,
                  recordingType: log.recording_type,
                  mimeType: 'audio/mp3',
                  expiresAt,
                });

                callLog.recordingId = recording._id;
                await callLog.save();
              }
            }
          }
        }

        // Count recordings created during call sync
        const recordingsCreated = await Recording.countDocuments({
          tenantId: tenant._id,
          createdAt: { $gte: new Date(Date.now() - 60000) } // Last minute
        });

        results.push({
          tenantId: tenant._id.toString(),
          tenantName: tenant.name,
          callsCreated,
          callsUpdated,
          recordingsCreated,
          success: true,
        });
      } catch (err) {
        console.error(`Sync error for tenant ${tenant._id}:`, err);
        results.push({
          tenantId: tenant._id.toString(),
          tenantName: tenant.name,
          error: err instanceof Error ? err.message : 'Unknown error',
          success: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      syncedTenants: results.filter(r => r.success).length,
      failedTenants: results.filter(r => !r.success).length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

// 手動同期用のPOSTエンドポイント
export async function POST(request: NextRequest) {
  return GET(request);
}
