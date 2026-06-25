import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongodb';
import CallLog from '@/models/CallLog';
import User from '@/models/User';
import { mockCallLogs, mockUsers } from '@/lib/mock-data';
import { getZoomConfigFromEnv } from '@/lib/zoom-config';
import { getZoomAccessToken, mapZoomResultToInternal } from '@/lib/zoom-phone';

interface ZoomCallLogResponseItem {
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
  owner?: {
    id?: string;
    name?: string;
  };
}

async function getZoomCalls(request: NextRequest) {
  const config = getZoomConfigFromEnv();
  if (!config) return null;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const result = searchParams.get('result') || 'all';
  const direction = searchParams.get('direction') || 'all';
  const hasRecording = searchParams.get('hasRecording') || 'all';
  const limit = parseInt(searchParams.get('limit') || '50');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = Math.min(Math.max(limit, 50), 300);
  const token = await getZoomAccessToken(config);

  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const url = new URL('https://api.zoom.us/v2/phone/call_logs');
  url.searchParams.set('from', from.toISOString().split('T')[0]);
  url.searchParams.set('to', now.toISOString().split('T')[0]);
  url.searchParams.set('page_size', String(pageSize));

  let nextPageToken = '';
  let total = 0;
  let calls: ZoomCallLogResponseItem[] = [];

  for (let currentPage = 1; currentPage <= page; currentPage++) {
    if (nextPageToken) {
      url.searchParams.set('next_page_token', nextPageToken);
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Zoom API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    total = Number(data.total_records || 0);
    calls = data.call_logs || [];
    nextPageToken = data.next_page_token || '';

    if (!nextPageToken) break;
  }

  let mappedCalls = calls.map((call) => {
    const callDirection = call.direction || 'outbound';
    const phoneNumber = callDirection === 'outbound'
      ? String(call.callee_did_number || call.callee_number || '')
      : String(call.caller_did_number || call.caller_number || '');
    const callResult = String(call.call_result || call.result || '');

    return {
      id: String(call.call_id || call.id),
      zoomCallId: String(call.call_id || call.id),
      userId: String(call.owner?.id || ''),
      userName: call.owner?.name || 'Zoomユーザー',
      direction: callDirection,
      phoneNumber,
      result: mapZoomResultToInternal(callResult),
      startTime: String(call.start_time || call.date_time || new Date().toISOString()),
      endTime: call.end_time,
      duration: Number(call.duration || 0),
      hasRecording: !!(call.recording_id || call.recording_status === 'recorded' || call.has_recording),
      recordingId: call.recording_id,
    };
  });

  if (search) {
    const normalizedSearch = search.replace(/-/g, '');
    mappedCalls = mappedCalls.filter((call) =>
      call.phoneNumber.replace(/-/g, '').includes(normalizedSearch)
    );
  }
  if (result !== 'all') {
    mappedCalls = mappedCalls.filter((call) => call.result === result);
  }
  if (direction !== 'all') {
    mappedCalls = mappedCalls.filter((call) => call.direction === direction);
  }
  if (hasRecording === 'true') {
    mappedCalls = mappedCalls.filter((call) => call.hasRecording);
  } else if (hasRecording === 'false') {
    mappedCalls = mappedCalls.filter((call) => !call.hasRecording);
  }

  return {
    calls: mappedCalls.slice(0, limit),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    source: 'zoom',
  };
}

function getMockCalls(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const result = searchParams.get('result') || 'all';
  const direction = searchParams.get('direction') || 'all';
  const hasRecording = searchParams.get('hasRecording') || 'all';
  const limit = parseInt(searchParams.get('limit') || '100');
  const page = parseInt(searchParams.get('page') || '1');
  const sortBy = searchParams.get('sortBy') || 'startTime';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  const userMap = new Map(mockUsers.map((user) => [user.id, user.name]));
  let calls = [...mockCallLogs];

  if (search) {
    const normalizedSearch = search.replace(/-/g, '');
    calls = calls.filter((call) =>
      call.phoneNumber.replace(/-/g, '').includes(normalizedSearch)
    );
  }

  if (result !== 'all') {
    calls = calls.filter((call) => call.result === result);
  }

  if (direction !== 'all') {
    calls = calls.filter((call) => call.direction === direction);
  }

  if (hasRecording === 'true') {
    calls = calls.filter((call) => call.hasRecording);
  } else if (hasRecording === 'false') {
    calls = calls.filter((call) => !call.hasRecording);
  }

  calls.sort((a, b) => {
    const order = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'duration') return (a.duration - b.duration) * order;
    if (sortBy === 'result') return a.result.localeCompare(b.result) * order;
    return (new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) * order;
  });

  const total = calls.length;
  const start = (page - 1) * limit;
  const paginatedCalls = calls.slice(start, start + limit).map((call) => ({
    id: call.id,
    zoomCallId: call.id,
    userId: call.userId,
    userName: userMap.get(call.userId) || 'デモユーザー',
    direction: call.direction,
    phoneNumber: call.phoneNumber,
    result: call.result,
    startTime: call.startTime,
    endTime: call.endTime,
    duration: call.duration,
    hasRecording: call.hasRecording,
  }));

  return {
    calls: paginatedCalls,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const result = searchParams.get('result') || 'all';
    const direction = searchParams.get('direction') || 'all';
    const hasRecording = searchParams.get('hasRecording') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100');
    const page = parseInt(searchParams.get('page') || '1');
    const sortBy = searchParams.get('sortBy') || 'startTime';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // クエリ構築
    const query: Record<string, unknown> = {
      tenantId: session.user.tenantId,
    };

    // 管理者以外は自分の通話のみ
    if (session.user.role !== 'admin') {
      query.userId = session.user.id;
    }

    if (search) {
      query.phoneNumber = { $regex: search.replace(/-/g, ''), $options: 'i' };
    }

    if (result !== 'all') {
      query.result = result;
    }

    if (direction !== 'all') {
      query.direction = direction;
    }

    if (hasRecording === 'true') {
      query.hasRecording = true;
      query.recordingId = { $exists: true, $ne: null };
    } else if (hasRecording === 'false') {
      query.$or = [
        { hasRecording: false },
        { hasRecording: { $exists: false } },
        { recordingId: { $exists: false } },
        { recordingId: null },
      ];
    }

    const skip = (page - 1) * limit;

    // ソート設定
    const allowedSortFields = ['startTime', 'duration', 'result'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'startTime';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [calls, total, users] = await Promise.all([
      CallLog.find(query)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      CallLog.countDocuments(query),
      User.find({ tenantId: session.user.tenantId }).lean(),
    ]);

    // ユーザー名マッピング
    const userMap = new Map(users.map(u => [u._id.toString(), u.name]));

    const callsWithUser = calls.map(call => ({
      id: call._id.toString(),
      zoomCallId: call.zoomCallId,
      userId: call.userId.toString(),
      userName: userMap.get(call.userId.toString()) || '不明',
      direction: call.direction,
      phoneNumber: call.phoneNumber,
      result: call.result,
      startTime: call.startTime.toISOString(),
      endTime: call.endTime?.toISOString(),
      duration: call.duration,
      hasRecording: call.hasRecording,
      recordingId: call.recordingId?.toString(),
    }));

    return NextResponse.json({
      calls: callsWithUser,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Failed to fetch calls:', error);
    try {
      const zoomCalls = await getZoomCalls(request);
      if (zoomCalls) {
        return NextResponse.json(zoomCalls);
      }
    } catch (zoomError) {
      console.error('Failed to fetch Zoom calls:', zoomError);
    }
    return NextResponse.json(getMockCalls(request));
  }
}
