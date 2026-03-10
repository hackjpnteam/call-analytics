import { NextRequest, NextResponse } from 'next/server';
import { testConnection } from '@/lib/zoom-phone';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, clientId, clientSecret } = body;

    if (!accountId || !clientId || !clientSecret) {
      return NextResponse.json(
        { error: '全ての認証情報を入力してください' },
        { status: 400 }
      );
    }

    const isConnected = await testConnection({
      accountId,
      clientId,
      clientSecret,
    });

    if (isConnected) {
      return NextResponse.json({ success: true, message: '接続成功' });
    } else {
      return NextResponse.json(
        { success: false, error: '接続に失敗しました。認証情報を確認してください。' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Zoom connection test error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '接続エラー' },
      { status: 500 }
    );
  }
}
