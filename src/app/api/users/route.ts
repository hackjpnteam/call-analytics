import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { User, Tenant } from '@/models';

// ユーザー一覧取得
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

    const users = await User.find({ tenantId, isActive: true })
      .select('-password')
      .sort({ createdAt: -1 });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}

// ユーザー追加
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, email, password, name, role, team, department } = body;

    if (!tenantId || !email || !password || !name) {
      return NextResponse.json(
        { error: '必須項目を入力してください' },
        { status: 400 }
      );
    }

    await connectDB();

    // テナント存在確認
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return NextResponse.json(
        { error: 'テナントが見つかりません' },
        { status: 404 }
      );
    }

    // メールアドレス重複チェック
    const existingUser = await User.findOne({ tenantId, email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 400 }
      );
    }

    // ユーザー作成
    const user = await User.create({
      tenantId,
      email,
      password, // モデルのpreフックでハッシュ化される
      name,
      role: role || 'operator',
      team,
      department,
      status: 'offline',
      isActive: true,
    });

    // パスワードを除外してレスポンス
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userResponse } = user.toObject();

    return NextResponse.json({
      success: true,
      user: userResponse,
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}
