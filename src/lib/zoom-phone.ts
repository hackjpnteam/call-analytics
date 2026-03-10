/**
 * Zoom Phone API Client
 * Server-to-Server OAuth認証を使用
 * https://developers.zoom.us/docs/zoom-phone/
 */

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZoomCallLog {
  id: string;
  call_id: string;
  caller_number: string;
  caller_name?: string;
  callee_number: string;
  callee_name?: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  result: string;
  date_time: string;
  end_time?: string;
  user_id: string;
  user_email: string;
  has_recording: boolean;
  recording_id?: string;
}

interface ZoomRecording {
  id: string;
  call_id: string;
  call_log_id: string;
  caller_number: string;
  callee_number: string;
  date_time: string;
  duration: number;
  download_url: string;
  file_size?: number;
}

interface ZoomUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_numbers?: { number: string }[];
  status: string;
  department?: string;
}

interface ZoomApiConfig {
  accountId: string;
  clientId: string;
  clientSecret: string;
}

// トークンキャッシュ
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Server-to-Server OAuthでアクセストークンを取得
 */
export async function getZoomAccessToken(config: ZoomApiConfig): Promise<string> {
  // キャッシュが有効ならそれを返す
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: config.accountId,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoom OAuth failed: ${response.status} ${error}`);
  }

  const data: ZoomTokenResponse = await response.json();

  // トークンをキャッシュ
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * Zoom API呼び出しのベース関数
 */
async function zoomApiRequest<T>(
  config: ZoomApiConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getZoomAccessToken(config);

  const response = await fetch(`https://api.zoom.us/v2${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoom API error: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * 通話ログを取得
 */
export async function getCallLogs(
  config: ZoomApiConfig,
  params: {
    from?: string; // YYYY-MM-DD
    to?: string;   // YYYY-MM-DD
    page_size?: number;
    next_page_token?: string;
    user_id?: string;
  } = {}
): Promise<{
  call_logs: ZoomCallLog[];
  next_page_token?: string;
  total_records: number;
}> {
  const searchParams = new URLSearchParams();
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  if (params.next_page_token) searchParams.set('next_page_token', params.next_page_token);

  const endpoint = params.user_id
    ? `/phone/users/${params.user_id}/call_logs?${searchParams}`
    : `/phone/call_history?${searchParams}`;

  return zoomApiRequest(config, endpoint);
}

/**
 * 全ての通話ログを取得（ページネーション対応）
 */
export async function getAllCallLogs(
  config: ZoomApiConfig,
  from: string,
  to: string
): Promise<ZoomCallLog[]> {
  const allLogs: ZoomCallLog[] = [];
  let nextPageToken: string | undefined;

  do {
    const result = await getCallLogs(config, {
      from,
      to,
      page_size: 100,
      next_page_token: nextPageToken,
    });

    allLogs.push(...result.call_logs);
    nextPageToken = result.next_page_token;
  } while (nextPageToken);

  return allLogs;
}

/**
 * 録音一覧を取得
 */
export async function getRecordings(
  config: ZoomApiConfig,
  params: {
    from?: string;
    to?: string;
    page_size?: number;
    next_page_token?: string;
  } = {}
): Promise<{
  recordings: ZoomRecording[];
  next_page_token?: string;
  total_records: number;
}> {
  const searchParams = new URLSearchParams();
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  if (params.next_page_token) searchParams.set('next_page_token', params.next_page_token);

  return zoomApiRequest(config, `/phone/recordings?${searchParams}`);
}

/**
 * 録音ファイルをダウンロード
 */
export async function downloadRecording(
  config: ZoomApiConfig,
  recordingId: string
): Promise<{ downloadUrl: string; token: string }> {
  const token = await getZoomAccessToken(config);

  // Zoom Phone録音一覧から該当録音を検索
  // 過去30日間の録音から検索
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().split('T')[0];
  const toStr = now.toISOString().split('T')[0];

  const recordings = await zoomApiRequest<{ recordings: ZoomRecording[] }>(
    config,
    `/phone/recordings?from=${fromStr}&to=${toStr}&page_size=300`
  );

  const recording = recordings.recordings?.find(r => r.id === recordingId);

  if (!recording || !recording.download_url) {
    throw new Error('Recording not found or download URL not available');
  }

  return {
    downloadUrl: recording.download_url,
    token,
  };
}

/**
 * Zoom Phoneユーザー一覧を取得
 */
export async function getPhoneUsers(
  config: ZoomApiConfig,
  params: {
    page_size?: number;
    next_page_token?: string;
  } = {}
): Promise<{
  users: ZoomUser[];
  next_page_token?: string;
  total_records: number;
}> {
  const searchParams = new URLSearchParams();
  if (params.page_size) searchParams.set('page_size', String(params.page_size));
  if (params.next_page_token) searchParams.set('next_page_token', params.next_page_token);

  return zoomApiRequest(config, `/phone/users?${searchParams}`);
}

/**
 * API接続テスト
 */
export async function testConnection(config: ZoomApiConfig): Promise<boolean> {
  try {
    await getZoomAccessToken(config);
    // 簡単なAPI呼び出しでテスト
    await zoomApiRequest(config, '/phone/users?page_size=1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Zoom通話結果を内部形式に変換
 */
export function mapZoomResultToInternal(
  zoomResult: string
): 'connected' | 'no_answer' | 'busy' | 'voicemail' | 'failed' | 'cancelled' {
  const mapping: Record<string, 'connected' | 'no_answer' | 'busy' | 'voicemail' | 'failed' | 'cancelled'> = {
    'answered': 'connected',
    'connected': 'connected',
    'no_answer': 'no_answer',
    'missed': 'no_answer',
    'busy': 'busy',
    'voicemail': 'voicemail',
    'failed': 'failed',
    'rejected': 'failed',
    'cancelled': 'cancelled',
    'abandoned': 'cancelled',
  };

  return mapping[zoomResult.toLowerCase()] || 'failed';
}

export type { ZoomCallLog, ZoomRecording, ZoomUser, ZoomApiConfig };
