import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { Recording, Tenant } from '@/models';
import { downloadRecording, ZoomApiConfig } from '@/lib/zoom-phone';

// 録音メタデータを取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await connectDB();

    const recording = await Recording.findById(id)
      .populate('callLogId')
      .populate('userId', 'name email');

    if (!recording) {
      return NextResponse.json(
        { error: '録音が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(recording);
  } catch (error) {
    console.error('Get recording error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}

// 録音のストリーミングURL取得
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await connectDB();

    const recording = await Recording.findById(id);
    if (!recording) {
      return NextResponse.json(
        { error: '録音が見つかりません' },
        { status: 404 }
      );
    }

    // ローカルファイルがある場合はそのURLを返す
    if (recording.fileUrl) {
      return NextResponse.json({ streamUrl: recording.fileUrl });
    }

    // Zoom APIから取得
    if (recording.zoomRecordingId) {
      const tenant = await Tenant.findById(recording.tenantId);
      if (!tenant?.zoomPhoneConfig?.accountId) {
        return NextResponse.json(
          { error: 'Zoom設定がありません' },
          { status: 400 }
        );
      }

      const config: ZoomApiConfig = {
        accountId: tenant.zoomPhoneConfig.accountId,
        clientId: tenant.zoomPhoneConfig.clientId!,
        clientSecret: tenant.zoomPhoneConfig.clientSecret!,
      };

      const { downloadUrl, token } = await downloadRecording(
        config,
        recording.zoomRecordingId
      );

      // トークン付きURLを返す
      return NextResponse.json({
        streamUrl: `${downloadUrl}?access_token=${token}`,
        expiresIn: 3600, // 1時間有効
      });
    }

    return NextResponse.json(
      { error: '録音ファイルが利用できません' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Get recording stream error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}
