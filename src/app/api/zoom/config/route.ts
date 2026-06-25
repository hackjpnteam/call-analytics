import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { Tenant } from '@/models';
import { getZoomConfigFromEnv } from '@/lib/zoom-config';

// Zoom設定を保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, accountId, clientId, clientSecret } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantIdが必要です' },
        { status: 400 }
      );
    }

    await connectDB();

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'テナントが見つかりません' },
        { status: 404 }
      );
    }

    // Zoom設定を更新
    tenant.zoomPhoneConfig = {
      accountId,
      clientId,
      clientSecret,
    };

    await tenant.save();

    return NextResponse.json({
      success: true,
      message: 'Zoom設定を保存しました',
    });
  } catch (error) {
    console.error('Save Zoom config error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}

// Zoom設定を取得（シークレットはマスク）
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

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'テナントが見つかりません' },
        { status: 404 }
      );
    }

    const config = tenant.zoomPhoneConfig;

    return NextResponse.json({
      isConfigured: !!(config?.accountId && config?.clientId && config?.clientSecret),
      accountId: config?.accountId || '',
      clientId: config?.clientId || '',
      // シークレットはマスク
      clientSecretMasked: config?.clientSecret ? '••••••••' : '',
    });
  } catch (error) {
    console.error('Get Zoom config error:', error);
    const envConfig = getZoomConfigFromEnv();
    if (envConfig) {
      return NextResponse.json({
        isConfigured: true,
        accountId: envConfig.accountId,
        clientId: envConfig.clientId,
        clientSecretMasked: '••••••••',
        source: 'environment',
      });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : 'エラー' }, { status: 500 });
  }
}
