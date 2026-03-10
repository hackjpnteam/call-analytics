import { CallDirection, CallResult, CallSummary, UserStatus } from '@/types';

// デフォルト勤務設定
const DEFAULT_WORK_START = '09:00';
const DEFAULT_WORK_END = '18:00';
const DEFAULT_BREAK_DURATION = 60; // minutes

// 勤務時間（分）を計算
function calculateWorkMinutes(startTime: string, endTime: string, breakDuration: number): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const workMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  return Math.max(0, workMinutes - breakDuration);
}

// アイドル時間計算（秒）
export function calculateIdleTime(
  totalCallDuration: number, // 秒
  workStartTime: string = DEFAULT_WORK_START,
  workEndTime: string = DEFAULT_WORK_END,
  breakDuration: number = DEFAULT_BREAK_DURATION
): number {
  const workMinutes = calculateWorkMinutes(workStartTime, workEndTime, breakDuration);
  const workSeconds = workMinutes * 60;
  const idleSeconds = workSeconds - totalCallDuration;
  return Math.max(0, idleSeconds);
}

// モックユーザーデータ
export const mockUsers = [
  {
    id: 'user-1',
    name: '山田太郎',
    email: 'yamada@example.com',
    role: 'admin' as const,
    status: 'available' as UserStatus,
    team: '営業1課',
    department: '営業部',
  },
  {
    id: 'user-2',
    name: '佐藤花子',
    email: 'sato@example.com',
    role: 'operator' as const,
    status: 'on_call' as UserStatus,
    team: '営業1課',
    department: '営業部',
  },
  {
    id: 'user-3',
    name: '鈴木一郎',
    email: 'suzuki@example.com',
    role: 'operator' as const,
    status: 'available' as UserStatus,
    team: '営業2課',
    department: '営業部',
  },
  {
    id: 'user-4',
    name: '田中美咲',
    email: 'tanaka@example.com',
    role: 'operator' as const,
    status: 'break' as UserStatus,
    team: '営業2課',
    department: '営業部',
  },
  {
    id: 'user-5',
    name: '高橋健太',
    email: 'takahashi@example.com',
    role: 'operator' as const,
    status: 'available' as UserStatus,
    team: '営業1課',
    department: '営業部',
  },
];

// モック通話ログ生成
function generateMockCalls(userId: string, count: number, baseDate: Date) {
  const results: CallResult[] = ['connected', 'no_answer', 'busy', 'voicemail', 'failed'];
  const resultWeights = [0.4, 0.25, 0.15, 0.12, 0.08];
  const calls = [];

  for (let i = 0; i < count; i++) {
    const rand = Math.random();
    let cumulative = 0;
    let result: CallResult = 'connected';

    for (let j = 0; j < results.length; j++) {
      cumulative += resultWeights[j];
      if (rand < cumulative) {
        result = results[j];
        break;
      }
    }

    const duration = result === 'connected'
      ? Math.floor(Math.random() * 600) + 30 // 30秒〜10分
      : Math.floor(Math.random() * 30); // 0〜30秒

    const startTime = new Date(baseDate);
    startTime.setHours(9 + Math.floor(Math.random() * 9)); // 9時〜18時
    startTime.setMinutes(Math.floor(Math.random() * 60));
    startTime.setSeconds(0);
    startTime.setDate(startTime.getDate() - Math.floor(Math.random() * 30));

    const endTime = new Date(startTime.getTime() + duration * 1000);

    calls.push({
      id: `call-${userId}-${i}`,
      userId,
      direction: Math.random() > 0.1 ? 'outbound' : 'inbound' as CallDirection,
      phoneNumber: `0${Math.floor(Math.random() * 10)}0-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      result,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      hasRecording: result === 'connected' && Math.random() > 0.2,
    });
  }

  return calls.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
}

// 全ユーザーの通話ログを生成
export const mockCallLogs = mockUsers.flatMap((user) =>
  generateMockCalls(user.id, 50 + Math.floor(Math.random() * 50), new Date())
);

// 日次サマリー計算
export function calculateDailySummary(
  calls: typeof mockCallLogs,
  date: Date
): CallSummary {
  const dateStr = date.toISOString().split('T')[0];
  const dayCalls = calls.filter(
    (call) => call.startTime.split('T')[0] === dateStr
  );

  const connected = dayCalls.filter((c) => c.result === 'connected');

  return {
    totalCalls: dayCalls.length,
    connectedCalls: connected.length,
    totalDuration: dayCalls.reduce((sum, c) => sum + c.duration, 0),
    averageDuration:
      connected.length > 0
        ? Math.round(connected.reduce((sum, c) => sum + c.duration, 0) / connected.length)
        : 0,
    idleTime: 0, // 後で計算
    noAnswerCalls: dayCalls.filter((c) => c.result === 'no_answer').length,
    busyCalls: dayCalls.filter((c) => c.result === 'busy').length,
    voicemailCalls: dayCalls.filter((c) => c.result === 'voicemail').length,
    failedCalls: dayCalls.filter((c) => c.result === 'failed').length,
  };
}

// ユーザー別サマリー
export function getUserSummary(
  userId: string,
  workStartTime: string = DEFAULT_WORK_START,
  workEndTime: string = DEFAULT_WORK_END,
  breakDuration: number = DEFAULT_BREAK_DURATION
): CallSummary {
  const userCalls = mockCallLogs.filter((call) => call.userId === userId);
  const connected = userCalls.filter((c) => c.result === 'connected');
  const totalDuration = userCalls.reduce((sum, c) => sum + c.duration, 0);

  return {
    totalCalls: userCalls.length,
    connectedCalls: connected.length,
    totalDuration,
    averageDuration:
      connected.length > 0
        ? Math.round(connected.reduce((sum, c) => sum + c.duration, 0) / connected.length)
        : 0,
    idleTime: calculateIdleTime(totalDuration, workStartTime, workEndTime, breakDuration),
    noAnswerCalls: userCalls.filter((c) => c.result === 'no_answer').length,
    busyCalls: userCalls.filter((c) => c.result === 'busy').length,
    voicemailCalls: userCalls.filter((c) => c.result === 'voicemail').length,
    failedCalls: userCalls.filter((c) => c.result === 'failed').length,
  };
}

// 全体サマリー
export function getTotalSummary(
  workStartTime: string = DEFAULT_WORK_START,
  workEndTime: string = DEFAULT_WORK_END,
  breakDuration: number = DEFAULT_BREAK_DURATION
): CallSummary {
  const connected = mockCallLogs.filter((c) => c.result === 'connected');
  const totalDuration = mockCallLogs.reduce((sum, c) => sum + c.duration, 0);

  // 全ユーザーのアイドル時間を合計
  const totalIdleTime = mockUsers.reduce((sum, user) => {
    const userSummary = getUserSummary(user.id, workStartTime, workEndTime, breakDuration);
    return sum + userSummary.idleTime;
  }, 0);

  return {
    totalCalls: mockCallLogs.length,
    connectedCalls: connected.length,
    totalDuration,
    averageDuration:
      connected.length > 0
        ? Math.round(connected.reduce((sum, c) => sum + c.duration, 0) / connected.length)
        : 0,
    idleTime: totalIdleTime,
    noAnswerCalls: mockCallLogs.filter((c) => c.result === 'no_answer').length,
    busyCalls: mockCallLogs.filter((c) => c.result === 'busy').length,
    voicemailCalls: mockCallLogs.filter((c) => c.result === 'voicemail').length,
    failedCalls: mockCallLogs.filter((c) => c.result === 'failed').length,
  };
}

// 日別データ生成（過去30日）
export function getDailyStats(userId?: string) {
  const stats = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    let dayCalls = mockCallLogs.filter(
      (call) => call.startTime.split('T')[0] === dateStr
    );
    if (userId) {
      dayCalls = dayCalls.filter((call) => call.userId === userId);
    }

    stats.push({
      date: dateStr,
      totalCalls: dayCalls.length,
      connectedCalls: dayCalls.filter((c) => c.result === 'connected').length,
      totalDuration: dayCalls.reduce((sum, c) => sum + c.duration, 0),
    });
  }

  return stats;
}

// 週別データ生成（過去12週）
export function getWeeklyStats(userId?: string) {
  const stats = [];
  const today = new Date();

  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    let weekCalls = mockCallLogs.filter((call) => {
      const callDate = new Date(call.startTime);
      return callDate >= weekStart && callDate <= weekEnd;
    });
    if (userId) {
      weekCalls = weekCalls.filter((call) => call.userId === userId);
    }

    stats.push({
      date: `${weekStart.getMonth() + 1}/${weekStart.getDate()}週`,
      totalCalls: weekCalls.length,
      connectedCalls: weekCalls.filter((c) => c.result === 'connected').length,
      totalDuration: weekCalls.reduce((sum, c) => sum + c.duration, 0),
    });
  }

  return stats;
}

// 月別データ生成（過去12ヶ月）
export function getMonthlyStats(userId?: string) {
  const stats = [];
  const today = new Date();

  for (let i = 11; i >= 0; i--) {
    const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);

    let monthCalls = mockCallLogs.filter((call) => {
      const callDate = new Date(call.startTime);
      return callDate >= month && callDate <= monthEnd;
    });
    if (userId) {
      monthCalls = monthCalls.filter((call) => call.userId === userId);
    }

    stats.push({
      date: `${month.getFullYear()}/${month.getMonth() + 1}`,
      totalCalls: monthCalls.length,
      connectedCalls: monthCalls.filter((c) => c.result === 'connected').length,
      totalDuration: monthCalls.reduce((sum, c) => sum + c.duration, 0),
    });
  }

  return stats;
}

// ユーザーランキング
export function getUserRanking(
  workStartTime: string = DEFAULT_WORK_START,
  workEndTime: string = DEFAULT_WORK_END,
  breakDuration: number = DEFAULT_BREAK_DURATION
) {
  return mockUsers
    .map((user) => ({
      ...user,
      summary: getUserSummary(user.id, workStartTime, workEndTime, breakDuration),
    }))
    .sort((a, b) => b.summary.connectedCalls - a.summary.connectedCalls);
}
