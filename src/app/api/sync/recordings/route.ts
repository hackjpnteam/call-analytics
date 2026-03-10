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

    // 録音をDBに保存
    for (const rec of allRecordings) {
      // 既存チェック
      const exists = await Recording.findOne({
        tenantId: tenant._id,
        zoomRecordingId: rec.id,
      });

      if (exists) {
        skipped++;
        continue;
      }

      // 対応する通話ログを探す
      const callLog = await CallLog.findOne({
        tenantId: tenant._id,
        zoomCallId: rec.call_id,
      });

      // 保管期限を計算
      const retentionDays = tenant.settings?.recordingRetentionDays || 180;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + retentionDays);

      try {
        const recording = await Recording.create({
          tenantId: tenant._id,
          callLogId: callLog?._id,
          userId: callLog?.userId || tenant._id,
          zoomRecordingId: rec.id,
          duration: rec.duration,
          fileSize: rec.file_size,
          zoomDownloadUrl: rec.download_url,
          mimeType: 'audio/mp3',
          isTranscribed: false,
          expiresAt,
        });

        // 通話ログに録音IDを紐付け
        if (callLog) {
          callLog.recordingId = recording._id;
          callLog.hasRecording = true;
          await callLog.save();
        }

        created++;
      } catch (err) {
        console.error('Failed to create recording:', err);
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `録音同期完了: ${created}件作成, ${skipped}件スキップ`,
      stats: { created, skipped, total: allRecordings.length },
    });
  } catch (error) {
    console.error('Recording sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '同期エラー' },
      { status: 500 }
    );
  }
}
