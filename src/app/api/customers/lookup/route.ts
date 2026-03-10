import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db/mongodb';
import User from '@/models/User';
import Customer from '@/models/Customer';

// 電話番号を正規化
function normalizePhone(phone: string): string {
  return phone.replace(/[-\s()]/g, '');
}

// 電話番号で顧客を検索
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phone');

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const normalizedPhone = normalizePhone(phoneNumber);

    // 完全一致を試行
    let customer = await Customer.findOne({
      tenantId: user.tenantId,
      phoneNumber: normalizedPhone,
    });

    // 部分一致（末尾8桁）を試行
    if (!customer && normalizedPhone.length >= 8) {
      const lastDigits = normalizedPhone.slice(-8);
      customer = await Customer.findOne({
        tenantId: user.tenantId,
        phoneNumber: { $regex: lastDigits + '$' },
      });
    }

    if (!customer) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      customer: {
        id: customer._id,
        customerId: customer.customerId,
        companyName: customer.companyName,
        contactName: customer.contactName,
        phoneNumber: customer.phoneNumberRaw,
        email: customer.email,
        industry: customer.industry,
        status: customer.status,
        notes: customer.notes,
        lastContactAt: customer.lastContactAt,
      },
    });
  } catch (error) {
    console.error('Customer lookup error:', error);
    return NextResponse.json({ error: 'Failed to lookup customer' }, { status: 500 });
  }
}
