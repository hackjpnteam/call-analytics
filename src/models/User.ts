import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole, UserStatus } from '@/types';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  statusChangedAt?: Date;
  zoomUserId?: string;
  zoomPhoneUserId?: string;
  zoomEmail?: string;
  zoomPhoneNumber?: string;
  zoomPhoneNumbers?: string[];
  zoomExtensionNumber?: number;
  zoomExtensionId?: string;
  zoomPhoneStatus?: string;
  zoomCallingPlans?: string[];
  zoomSiteId?: string;
  zoomSiteName?: string;
  zoomDepartment?: string;
  zoomCostCenter?: string;
  team?: string;
  department?: string;
  isActive: boolean;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['operator', 'admin'], default: 'operator' },
    status: {
      type: String,
      enum: ['available', 'on_call', 'break', 'away', 'offline'],
      default: 'offline',
    },
    statusChangedAt: { type: Date, default: Date.now },
    zoomUserId: String,
    zoomPhoneUserId: String,
    zoomEmail: String,
    zoomPhoneNumber: String,
    zoomPhoneNumbers: [String],
    zoomExtensionNumber: Number,
    zoomExtensionId: String,
    zoomPhoneStatus: String,
    zoomCallingPlans: [String],
    zoomSiteId: String,
    zoomSiteName: String,
    zoomDepartment: String,
    zoomCostCenter: String,
    team: String,
    department: String,
    isActive: { type: Boolean, default: true },
    lastActiveAt: Date,
  },
  { timestamps: true }
);

// インデックス：テナント内でのメールアドレス一意性
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

// パスワードハッシュ化
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// パスワード検証メソッド
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
