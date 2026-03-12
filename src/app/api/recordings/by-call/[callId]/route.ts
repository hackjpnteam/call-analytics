import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongodb';
import { CallLog, Tenant, Recording } from '@/models';
import { getZoomAccessToken, ZoomApiConfig } from '@/lib/zoom-phone';

// 通話IDから録音のストリーミングURLを取得
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { callId } = await params;

    await connectDB();

    // 通話ログを取得
    const callLog = await CallLog.findById(callId);
    if (!callLog) {
      return NextResponse.json({ error: '通話が見つかりません' }, { status: 404 });
    }

    // 権限チェック
    if (session.user.role !== 'admin' && callLog.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 既存のRecordingがある場合はそれを使用
    if (callLog.recordingId) {
      const recording = await Recording.findById(callLog.recordingId);
      if (recording?.zoomDownloadUrl) {
        const tenant = await Tenant.findById(callLog.tenantId);
        if (tenant?.zoomPhoneConfig?.accountId) {
          const config: ZoomApiConfig = {
            accountId: tenant.zoomPhoneConfig.accountId,
            clientId: tenant.zoomPhoneConfig.clientId!,
            clientSecret: tenant.zoomPhoneConfig.clientSecret!,
          };
          const token = await getZoomAccessToken(config);
          return NextResponse.json({
            streamUrl: `${recording.zoomDownloadUrl}?access_token=${token}`,
            expiresIn: 3600,
          });
        }
      }
    }

    // Zoom APIから直接録音を検索
    const tenant = await Tenant.findById(callLog.tenantId);
    if (!tenant?.zoomPhoneConfig?.accountId) {
      return NextResponse.json({ error: 'Zoom設定がありません' }, { status: 400 });
    }

    const config: ZoomApiConfig = {
      accountId: tenant.zoomPhoneConfig.accountId,
      clientId: tenant.zoomPhoneConfig.clientId!,
      clientSecret: tenant.zoomPhoneConfig.clientSecret!,
    };

    const token = await getZoomAccessToken(config);

    // 過去30日間の録音から検索
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = now.toISOString().split('T')[0];

    const response = await fetch(
      `https://api.zoom.us/v2/phone/call_logs/recordings?from=${fromStr}&to=${toStr}&page_size=300`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      console.error('Zoom API error:', await response.text());
      return NextResponse.json({ error: '録音を取得できません' }, { status: 500 });
    }

    const data = await response.json();
    const recordings = data.recordings || [];

    // zoomCallIdに一致する録音を探す
    const recording = recordings.find((rec: Record<string, unknown>) => {
      const recCallId = rec.call_id || rec.call_log_id;
      return recCallId === callLog.zoomCallId;
    });

    if (!recording || !recording.download_url) {
      return NextResponse.json({ error: '録音が見つかりません' }, { status: 404 });
    }

    // Recordingを保存して次回から使えるようにする
    const retentionDays = tenant.settings?.recordingRetentionDays || 180;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);

    const newRecording = await Recording.create({
      tenantId: tenant._id,
      callLogId: callLog._id,
      userId: callLog.userId,
      zoomRecordingId: String(recording.id),
      duration: recording.duration || callLog.duration,
      zoomDownloadUrl: recording.download_url,
      mimeType: 'audio/mp3',
      isTranscribed: false,
      expiresAt,
    });

    // 通話ログに録音IDを紐付け
    callLog.recordingId = newRecording._id;
    callLog.hasRecording = true;
    await callLog.save();

    return NextResponse.json({
      streamUrl: `${recording.download_url}?access_token=${token}`,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('Get recording by call error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}
