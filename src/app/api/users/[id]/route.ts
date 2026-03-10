import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { User } from '@/models';

// ユーザー詳細取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await connectDB();

    const user = await User.findById(id).select('-password');
    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}

// ユーザー更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, email, role, team, department, password } = body;

    await connectDB();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    // 更新
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (team !== undefined) user.team = team;
    if (department !== undefined) user.department = department;
    if (password) user.password = password; // preフックでハッシュ化

    await user.save();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userResponse } = user.toObject();

    return NextResponse.json({
      success: true,
      user: userResponse,
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}

// ユーザー削除（論理削除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await connectDB();

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' },
        { status: 404 }
      );
    }

    // 論理削除
    user.isActive = false;
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'ユーザーを削除しました',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'エラー' },
      { status: 500 }
    );
  }
}
