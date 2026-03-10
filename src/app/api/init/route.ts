import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { Tenant, User } from '@/models';

// 初期化API: デモテナントとユーザーを作成
export async function POST() {
  try {
    await connectDB();

    // デモテナントが存在するか確認
    let tenant = await Tenant.findOne({ slug: 'demo' });

    if (!tenant) {
      // テナント作成
      tenant = await Tenant.create({
        name: 'デモ会社',
        slug: 'demo',
        settings: {
          workStartTime: '09:00',
          workEndTime: '18:00',
          breakDuration: 60,
          recordingRetentionDays: 180,
        },
        isActive: true,
      });
      console.log('Demo tenant created:', tenant._id);
    }

    // 管理者ユーザーが存在するか確認
    const adminExists = await User.findOne({
      tenantId: tenant._id,
      email: 'tomura@hackjpn.com',
    });

    if (!adminExists) {
      await User.create({
        tenantId: tenant._id,
        email: 'tomura@hackjpn.com',
        password: 'hikarutomura',
        name: '戸村光',
        role: 'admin',
        status: 'offline',
        isActive: true,
      });
      console.log('Admin user created');
    }

    // オペレーターユーザーが存在するか確認
    const operatorExists = await User.findOne({
      tenantId: tenant._id,
      email: 'team@hackjpn.com',
    });

    if (!operatorExists) {
      await User.create({
        tenantId: tenant._id,
        email: 'team@hackjpn.com',
        password: 'hikarutomura',
        name: 'チームメンバー',
        role: 'operator',
        status: 'offline',
        isActive: true,
      });
      console.log('Operator user created');
    }

    return NextResponse.json({
      success: true,
      tenantId: tenant._id.toString(),
      message: '初期化完了',
    });
  } catch (error) {
    console.error('Init error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '初期化エラー' },
      { status: 500 }
    );
  }
}
