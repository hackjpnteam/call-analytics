import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { Recording, CallLog, Tenant } from '@/models';
import { getRecordings, ZoomApiConfig } from '@/lib/zoom-phone';

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

    // 日付範囲の設定
    const toDate = to || new Date().toISOString().split('T')[0];
    const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Zoom APIから録音一覧を取得
    let allRecordings: Awaited<ReturnType<typeof getRecordings>>['recordings'] = [];
    let nextPageToken: string | undefined;

    do {
      const result = await getRecordings(config, {
        from: fromDate,
        to: toDate,
        page_size: 100,
        next_page_token: nextPageToken,
      });
      allRecordings.push(...result.recordings);
      nextPageToken = result.next_page_token;
    } while (nextPageToken);

    let created = 0;
    let skipped = 0;
    let linked = 0;

    console.log(`Recording sync: Found ${allRecordings.length} recordings from Zoom API`);

    // 録音をDBに保存
    for (const rec of allRecordings) {
      // Zoom APIのフィールド名対応
      const recAny = rec as unknown as Record<string, unknown>;
      const recordingId = recAny.id || recAny.recording_id;
      const callId = recAny.call_id || recAny.call_log_id;

      if (!recordingId) {
        skipped++;
        continue;
      }

      // 既存チェック
      const exists = await Recording.findOne({
        tenantId: tenant._id,
        zoomRecordingId: String(recordingId),
      });

      if (exists) {
        skipped++;
        continue;
      }

      // 対応する通話ログを探す
      const callIdStr = String(callId || '');
      const callLogIdStr = String(recAny.call_log_id || '');

      let callLog = await CallLog.findOne({
        tenantId: tenant._id,
        zoomCallId: callIdStr,
      });

      // call_idで見つからない場合はcall_log_idで検索
      if (!callLog && callLogIdStr && callLogIdStr !== callIdStr) {
        callLog = await CallLog.findOne({
          tenantId: tenant._id,
          zoomCallId: callLogIdStr,
        });
      }

      // 保管期限を計算
      const retentionDays = tenant.settings?.recordingRetentionDays || 180;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + retentionDays);

      try {
        const downloadUrl = recAny.download_url || recAny.file_url || '';
        const duration = recAny.duration || recAny.recording_duration || 0;
        const fileSize = recAny.file_size || recAny.recording_file_size;

        const recording = await Recording.create({
          tenantId: tenant._id,
          callLogId: callLog?._id,
          userId: callLog?.userId || tenant._id,
          zoomRecordingId: String(recordingId),
          duration: Number(duration),
          fileSize: fileSize ? Number(fileSize) : undefined,
          zoomDownloadUrl: String(downloadUrl),
          mimeType: 'audio/mp3',
          isTranscribed: false,
          expiresAt,
        });

        // 通話ログに録音IDを紐付け
        if (callLog) {
          callLog.recordingId = recording._id;
          callLog.hasRecording = true;
          await callLog.save();
          linked++;
        }

        created++;
      } catch (err) {
        console.error('Failed to create recording:', err);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `録音同期完了: ${created}件作成, ${linked}件紐付け, ${skipped}件スキップ`,
      stats: { created, linked, skipped, total: allRecordings.length },
    });
  } catch (error) {
    console.error('Recording sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '同期エラー' },
      { status: 500 }
    );
  }
}
