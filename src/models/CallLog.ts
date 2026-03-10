import mongoose, { Schema, Document, Model } from 'mongoose';
import { CallDirection, CallResult } from '@/types';

export interface ICallLog extends Document {
  _id: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  zoomCallId?: string;  // Zoom Phone上の通話ID
  customerId?: string;  // 顧客ID（FileMaker連携用）
  direction: CallDirection;
  phoneNumber: string;  // 相手の電話番号
  callerName?: string;  // 発信者名（わかる場合）
  result: CallResult;
  startTime: Date;
  endTime?: Date;
  duration: number;     // 通話時間（秒）
  ringDuration?: number; // 呼び出し時間（秒）
  hasRecording: boolean;
  recordingId?: mongoose.Types.ObjectId;
  notes?: string;       // メモ
  tags?: string[];      // タグ
  fileMakerSynced?: boolean;  // FileMaker同期済み
  fileMakerSyncedAt?: Date;   // FileMaker同期日時
  createdAt: Date;
  updatedAt: Date;
}

const CallLogSchema = new Schema<ICallLog>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    zoomCallId: String,
    customerId: String,
    direction: {
      type: String,
      enum: ['outbound', 'inbound'],
      required: true,
    },
    phoneNumber: { type: String, required: true },
    callerName: String,
    result: {
      type: String,
      enum: ['connected', 'no_answer', 'busy', 'voicemail', 'failed', 'cancelled'],
      required: true,
    },
    startTime: { type: Date, required: true },
    endTime: Date,
    duration: { type: Number, default: 0 },
    ringDuration: Number,
    hasRecording: { type: Boolean, default: false },
    recordingId: { type: Schema.Types.ObjectId, ref: 'Recording' },
    notes: String,
    tags: [String],
    fileMakerSynced: { type: Boolean, default: false },
    fileMakerSyncedAt: Date,
  },
  { timestamps: true }
);

// インデックス
CallLogSchema.index({ tenantId: 1, userId: 1, startTime: -1 });
CallLogSchema.index({ tenantId: 1, startTime: -1 });
CallLogSchema.index({ phoneNumber: 1 });

const CallLog: Model<ICallLog> =
  mongoose.models.CallLog || mongoose.model<ICallLog>('CallLog', CallLogSchema);

export default CallLog;
