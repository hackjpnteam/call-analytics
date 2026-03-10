import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICustomer extends Document {
  _id: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  fileMakerRecordId?: string;  // FileMakerのレコードID
  customerId: string;          // 顧客ID
  companyName: string;         // 会社名
  contactName: string;         // 担当者名
  phoneNumber: string;         // 電話番号（正規化済み）
  phoneNumberRaw: string;      // 電話番号（元の形式）
  email?: string;              // メールアドレス
  address?: string;            // 住所
  industry?: string;           // 業種
  status: string;              // ステータス
  notes?: string;              // メモ
  lastContactAt?: Date;        // 最終連絡日
  syncedAt?: Date;             // FileMaker同期日時
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    fileMakerRecordId: String,
    customerId: { type: String, required: true },
    companyName: { type: String, required: true },
    contactName: { type: String, default: '' },
    phoneNumber: { type: String, required: true },
    phoneNumberRaw: { type: String, required: true },
    email: String,
    address: String,
    industry: String,
    status: { type: String, default: 'active' },
    notes: String,
    lastContactAt: Date,
    syncedAt: Date,
  },
  { timestamps: true }
);

// インデックス
CustomerSchema.index({ tenantId: 1, customerId: 1 }, { unique: true });
CustomerSchema.index({ tenantId: 1, phoneNumber: 1 });
CustomerSchema.index({ tenantId: 1, companyName: 'text', contactName: 'text' });

const Customer: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default Customer;
