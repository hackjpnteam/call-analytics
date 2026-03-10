export type UserRole = 'operator' | 'admin';

export type CallDirection = 'outbound' | 'inbound';

export type CallResult =
  | 'connected'      // 接続
  | 'no_answer'      // 不在
  | 'busy'           // 話中
  | 'voicemail'      // 留守電
  | 'failed'         // 失敗
  | 'cancelled';     // キャンセル

export type UserStatus = 'available' | 'on_call' | 'break' | 'away' | 'offline';

export interface TenantSettings {
  workStartTime: string;  // "09:00"
  workEndTime: string;    // "18:00"
  breakDuration: number;  // minutes
  recordingRetentionDays: number;
}

export interface CallSummary {
  totalCalls: number;
  connectedCalls: number;
  totalDuration: number;      // seconds
  averageDuration: number;    // seconds
  idleTime: number;           // seconds
  noAnswerCalls: number;
  busyCalls: number;
  voicemailCalls: number;
  failedCalls: number;
}

export interface DashboardStats extends CallSummary {
  date: string;
  userId?: string;
  tenantId: string;
}
