import { getZoomAccessToken, mapZoomResultToInternal } from '@/lib/zoom-phone';
import { getZoomConfigFromEnv } from '@/lib/zoom-config';

export interface LiveCall {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  direction: 'inbound' | 'outbound';
  phoneNumber: string;
  result: 'connected' | 'no_answer' | 'busy' | 'voicemail' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  duration: number;
  hasRecording: boolean;
  recordingId?: string;
}

interface ZoomCallLogItem {
  id?: string;
  call_id?: string;
  direction?: 'inbound' | 'outbound';
  caller_number?: string;
  caller_did_number?: string;
  callee_number?: string;
  callee_did_number?: string;
  call_result?: string;
  result?: string;
  date_time?: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
  recording_id?: string;
  recording_status?: string;
  has_recording?: boolean;
  user_email?: string;
  owner?: {
    id?: string;
    name?: string;
    email?: string;
  };
}

export function getStartDateForPeriod(period: string): Date {
  const now = new Date();
  if (period === 'weekly') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return start;
  }
  if (period === 'monthly') {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 1);
    return start;
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function getLiveZoomCalls(period = 'daily', maxPages = 10): Promise<LiveCall[]> {
  const config = getZoomConfigFromEnv();
  if (!config) return [];

  const token = await getZoomAccessToken(config);
  const from = getStartDateForPeriod(period);
  const to = new Date();
  const calls: LiveCall[] = [];
  let nextPageToken = '';

  for (let page = 0; page < maxPages; page++) {
    const url = new URL('https://api.zoom.us/v2/phone/call_logs');
    url.searchParams.set('from', from.toISOString().split('T')[0]);
    url.searchParams.set('to', to.toISOString().split('T')[0]);
    url.searchParams.set('page_size', '300');
    if (nextPageToken) url.searchParams.set('next_page_token', nextPageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`Zoom API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const pageCalls: ZoomCallLogItem[] = data.call_logs || [];
    calls.push(...pageCalls.map(mapZoomCall));
    nextPageToken = data.next_page_token || '';
    if (!nextPageToken) break;
  }

  return calls;
}

function mapZoomCall(call: ZoomCallLogItem): LiveCall {
  const direction = call.direction || 'outbound';
  const phoneNumber = direction === 'outbound'
    ? String(call.callee_did_number || call.callee_number || '')
    : String(call.caller_did_number || call.caller_number || '');

  return {
    id: String(call.call_id || call.id || crypto.randomUUID()),
    userId: String(call.owner?.id || call.user_email || 'unknown'),
    userName: call.owner?.name || call.user_email || 'Zoomユーザー',
    userEmail: call.owner?.email || call.user_email || '',
    direction,
    phoneNumber,
    result: mapZoomResultToInternal(String(call.call_result || call.result || ''), Number(call.duration || 0)),
    startTime: String(call.start_time || call.date_time || new Date().toISOString()),
    endTime: call.end_time,
    duration: Number(call.duration || 0),
    hasRecording: !!(call.recording_id || call.recording_status === 'recorded' || call.has_recording),
    recordingId: call.recording_id,
  };
}

export function summarizeCalls(calls: LiveCall[]) {
  const connected = calls.filter((call) => call.result === 'connected');
  return {
    totalCalls: calls.length,
    connectedCalls: connected.length,
    totalDuration: calls.reduce((sum, call) => sum + call.duration, 0),
    averageDuration: connected.length > 0
      ? Math.round(connected.reduce((sum, call) => sum + call.duration, 0) / connected.length)
      : 0,
    noAnswerCalls: calls.filter((call) => call.result === 'no_answer').length,
    busyCalls: calls.filter((call) => call.result === 'busy').length,
    voicemailCalls: calls.filter((call) => call.result === 'voicemail').length,
    failedCalls: calls.filter((call) => call.result === 'failed').length,
  };
}

export function buildUserRanking(calls: LiveCall[]) {
  const userMap = new Map<string, LiveCall[]>();
  for (const call of calls) {
    const key = call.userId || call.userName;
    userMap.set(key, [...(userMap.get(key) || []), call]);
  }

  return Array.from(userMap.entries())
    .map(([id, userCalls]) => {
      const summary = summarizeCalls(userCalls);
      const first = userCalls[0];
      return {
        id,
        name: first.userName,
        email: first.userEmail || '',
        summary: {
          totalCalls: summary.totalCalls,
          connectedCalls: summary.connectedCalls,
          totalDuration: summary.totalDuration,
          averageDuration: summary.averageDuration,
        },
        periodSummary: {
          totalCalls: summary.totalCalls,
          connectedCalls: summary.connectedCalls,
        },
      };
    })
    .filter((user) => user.summary.totalCalls > 0)
    .sort((a, b) => b.summary.totalCalls - a.summary.totalCalls);
}

export function buildDailyStats(calls: LiveCall[], period: string) {
  const now = new Date();
  const daysToShow = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;

  return Array.from({ length: daysToShow }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (daysToShow - 1 - index));
    const dateStr = date.toISOString().split('T')[0];
    const dayCalls = calls.filter((call) => call.startTime.split('T')[0] === dateStr);

    return {
      date: dateStr,
      totalCalls: dayCalls.length,
      connectedCalls: dayCalls.filter((call) => call.result === 'connected').length,
      totalDuration: dayCalls.reduce((sum, call) => sum + call.duration, 0),
    };
  });
}
