import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db/mongodb';
import Tenant from '@/models/Tenant';
import User from '@/models/User';
import { filemakerClient } from '@/lib/filemaker';

// FileMaker設定取得
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const tenant = await Tenant.findById(user.tenantId);
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // パスワードは返さない
    const config = tenant.fileMakerConfig ? {
      host: tenant.fileMakerConfig.host || '',
      database: tenant.fileMakerConfig.database || '',
      username: tenant.fileMakerConfig.username || '',
      customerLayout: tenant.fileMakerConfig.customerLayout || '',
      callLogLayout: tenant.fileMakerConfig.callLogLayout || '',
      autoSync: tenant.fileMakerConfig.autoSync || false,
      lastSyncAt: tenant.fileMakerConfig.lastSyncAt,
    } : null;

    return NextResponse.json({ config });
  } catch (error) {
    console.error('Get FileMaker config error:', error);
    return NextResponse.json({ error: 'Failed to get config' }, { status: 500 });
  }
}

// FileMaker設定保存
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { host, database, username, password, customerLayout, callLogLayout, autoSync } = body;

    const tenant = await Tenant.findByIdAndUpdate(
      user.tenantId,
      {
        $set: {
          'fileMakerConfig.host': host,
          'fileMakerConfig.database': database,
          'fileMakerConfig.username': username,
          ...(password && { 'fileMakerConfig.password': password }),
          'fileMakerConfig.customerLayout': customerLayout,
          'fileMakerConfig.callLogLayout': callLogLayout,
          'fileMakerConfig.autoSync': autoSync,
        },
      },
      { new: true }
    );

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save FileMaker config error:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}

// 接続テスト
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { host, database, username, password, customerLayout, callLogLayout } = body;

    filemakerClient.setConfig({
      host,
      database,
      username,
      password,
      customerLayout,
      callLogLayout,
    });

    const success = await filemakerClient.testConnection();

    return NextResponse.json({ success });
  } catch (error) {
    console.error('FileMaker connection test error:', error);
    return NextResponse.json({ success: false, error: String(error) });
  }
}
