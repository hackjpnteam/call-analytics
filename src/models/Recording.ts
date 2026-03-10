import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRecording extends Document {
  _id: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  callLogId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  zoomRecordingId?: string;
  duration: number;        // 録音時間（秒）
  fileSize?: number;       // ファイルサイズ（bytes）
  fileUrl?: string;        // ストレージURL（S3等）
  zoomDownloadUrl?: string; // Zoom APIからのダウンロードURL
  mimeType: string;
  isTranscribed: boolean;  // 文字起こし済みか
  transcription?: string;  // 文字起こしテキスト
  expiresAt?: Date;        // 保管期限
  createdAt: Date;
  updatedAt: Date;
}

const RecordingSchema = new Schema<IRecording>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    callLogId: { type: Schema.Types.ObjectId, ref: 'CallLog', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    zoomRecordingId: String,
    duration: { type: Number, required: true },
    fileSize: Number,
    fileUrl: String,
    zoomDownloadUrl: String,
    mimeType: { type: String, default: 'audio/mp3' },
    isTranscribed: { type: Boolean, default: false },
    transcription: String,
    expiresAt: Date,
  },
  { timestamps: true }
);

// インデックス
RecordingSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
RecordingSchema.index({ callLogId: 1 });
RecordingSchema.index({ expiresAt: 1 });

const Recording: Model<IRecording> =
  mongoose.models.Recording || mongoose.model<IRecording>('Recording', RecordingSchema);

export default Recording;
