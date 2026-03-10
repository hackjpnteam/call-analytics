import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { Tenant } from '@/models';

// テナント一覧取得
export async function GET() {
  try {
    await connectDB();
    const tenants = await Tenant.find({ isActive: true });
    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('Get tenants error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}

// テナント作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: '名前とスラッグは必須です' },
        { status: 400 }
      );
    }

    await connectDB();

    // スラッグ重複チェック
    const existing = await Tenant.findOne({ slug });
    if (existing) {
      return NextResponse.json(
        { error: 'このスラッグは既に使用されています' },
        { status: 400 }
      );
    }

    const tenant = await Tenant.create({
      name,
      slug,
      settings: {
        workStartTime: '09:00',
        workEndTime: '18:00',
        breakDuration: 60,
        recordingRetentionDays: 180,
      },
      isActive: true,
    });

    return NextResponse.json({
      success: true,
      tenant,
    });
  } catch (error) {
    console.error('Create tenant error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}
