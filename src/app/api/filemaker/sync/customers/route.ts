import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db/mongodb';
import Tenant from '@/models/Tenant';
import User from '@/models/User';
import Customer from '@/models/Customer';
import { filemakerClient, CustomerData } from '@/lib/filemaker';

// 電話番号を正規化
function normalizePhone(phone: string): string {
  return phone.replace(/[-\s()]/g, '');
}

// FileMakerから顧客データをインポート
export async function POST() {
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
    if (!tenant || !tenant.fileMakerConfig?.host) {
      return NextResponse.json({ error: 'FileMaker not configured' }, { status: 400 });
    }

    // FileMakerクライアント設定
    filemakerClient.setConfig({
      host: tenant.fileMakerConfig.host,
      database: tenant.fileMakerConfig.database!,
      username: tenant.fileMakerConfig.username!,
      password: tenant.fileMakerConfig.password!,
      customerLayout: tenant.fileMakerConfig.customerLayout!,
      callLogLayout: tenant.fileMakerConfig.callLogLayout!,
    });

    // 顧客データを取得
    const records = await filemakerClient.getCustomers(1000);

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const record of records) {
      try {
        const data: CustomerData = record.fieldData;
        const normalizedPhone = normalizePhone(data.電話番号);

        const customerData = {
          tenantId: user.tenantId,
          fileMakerRecordId: record.recordId,
          customerId: data.顧客ID,
          companyName: data.会社名,
          contactName: data.担当者名 || '',
          phoneNumber: normalizedPhone,
          phoneNumberRaw: data.電話番号,
          email: data.メールアドレス,
          address: data.住所,
          industry: data.業種,
          status: data.ステータス || 'active',
          notes: data.メモ,
          lastContactAt: data.最終連絡日 ? new Date(data.最終連絡日) : undefined,
          syncedAt: new Date(),
        };

        const result = await Customer.findOneAndUpdate(
          { tenantId: user.tenantId, customerId: data.顧客ID },
          customerData,
          { upsert: true, new: true }
        );

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          created++;
        } else {
          updated++;
        }
      } catch (error) {
        console.error('Customer import error:', error);
        errors++;
      }
    }

    // 最終同期日時を更新
    await Tenant.findByIdAndUpdate(user.tenantId, {
      'fileMakerConfig.lastSyncAt': new Date(),
    });

    return NextResponse.json({
      success: true,
      stats: {
        total: records.length,
        created,
        updated,
        errors,
      },
    });
  } catch (error) {
    console.error('Customer sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync customers' },
      { status: 500 }
    );
  }
}

// 顧客一覧取得
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const customers = await Customer.find({ tenantId: user.tenantId })
      .sort({ companyName: 1 })
      .limit(500);

    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    return NextResponse.json({ error: 'Failed to get customers' }, { status: 500 });
  }
}
