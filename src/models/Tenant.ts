import mongoose, { Schema, Document, Model } from 'mongoose';
import { TenantSettings } from '@/types';

export interface ITenant extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;  // URL用の識別子
  settings: TenantSettings;
  zoomPhoneConfig?: {
    accountId?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
  };
  fileMakerConfig?: {
    host?: string;
    database?: string;
    username?: string;
    password?: string;
    customerLayout?: string;
    callLogLayout?: string;
    autoSync?: boolean;
    lastSyncAt?: Date;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    settings: {
      workStartTime: { type: String, default: '09:00' },
      workEndTime: { type: String, default: '18:00' },
      breakDuration: { type: Number, default: 60 },
      recordingRetentionDays: { type: Number, default: 180 },
    },
    zoomPhoneConfig: {
      accountId: String,
      clientId: String,
      clientSecret: String,
      accessToken: String,
      refreshToken: String,
      tokenExpiresAt: Date,
    },
    fileMakerConfig: {
      host: String,
      database: String,
      username: String,
      password: String,
      customerLayout: String,
      callLogLayout: String,
      autoSync: { type: Boolean, default: false },
      lastSyncAt: Date,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Tenant: Model<ITenant> =
  mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema);

export default Tenant;
