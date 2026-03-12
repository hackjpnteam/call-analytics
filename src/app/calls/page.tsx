'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { DashboardLayout } from '@/components/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  Pause,
  Search,
  Download,
  Filter,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { FullPageLoading, LoadingSpinner } from '@/components/ui/loading-spinner';
import { CallResult } from '@/types';

interface CallData {
  id: string;
  zoomCallId?: string;
  userId: string;
  userName: string;
  direction: 'inbound' | 'outbound';
  phoneNumber: string;
  result: CallResult;
  startTime: string;
  endTime?: string;
  duration: number;
  hasRecording: boolean;
  recordingId?: string;
}

const resultLabels: Record<CallResult, string> = {
  connected: '接続',
  no_answer: '不在',
  busy: '話中',
  voicemail: '留守電',
  failed: '失敗',
  cancelled: 'キャンセル',
};

const resultColors: Record<CallResult, string> = {
  connected: 'bg-green-100 text-green-800',
  no_answer: 'bg-amber-100 text-amber-800',
  busy: 'bg-red-100 text-red-800',
  voicemail: 'bg-purple-100 text-purple-800',
  failed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function CallsPage() {
  const { data: session, status } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [directionFilter, setDirectionFilter] = useState<string>('all');
  const [recordingFilter, setRecordingFilter] = useState<string>('all');
  const [calls, setCalls] = useState<CallData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [sortBy, setSortBy] = useState<string>('startTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 50;

  // ソート切り替え
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // ソートアイコン
  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Play recording
  const [loadingRecording, setLoadingRecording] = useState<string | null>(null);

  const handlePlayRecording = async (callId: string, recordingId?: string) => {
    if (playingId === callId) {
      // Stop playing
      audioRef?.pause();
      setPlayingId(null);
      return;
    }

    setLoadingRecording(callId);

    try {
      let res;
      if (recordingId) {
        // 既存のrecordingIdがある場合
        res = await fetch(`/api/recordings/${recordingId}`, { method: 'POST' });
      } else {
        // recordingIdがない場合は通話IDから取得
        res = await fetch(`/api/recordings/by-call/${callId}`, { method: 'POST' });
      }

      if (res.ok) {
        const data = await res.json();
        if (data.streamUrl) {
          audioRef?.pause();
          const audio = new Audio(data.streamUrl);
          audio.onended = () => setPlayingId(null);
          audio.play();
          setAudioRef(audio);
          setPlayingId(callId);
        }
      } else {
        const error = await res.json();
        console.error('Recording error:', error);
        alert(error.error || '録音を再生できません');
      }
    } catch (err) {
      console.error('Failed to play recording:', err);
      alert('録音の取得に失敗しました');
    } finally {
      setLoadingRecording(null);
    }
  };

  // データ取得
  useEffect(() => {
    const fetchCalls = async () => {
      if (!session) return;

      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (resultFilter !== 'all') params.set('result', resultFilter);
        if (directionFilter !== 'all') params.set('direction', directionFilter);
        if (recordingFilter !== 'all') params.set('hasRecording', recordingFilter);
        params.set('limit', String(limit));
        params.set('page', String(page));
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);

        const res = await fetch(`/api/calls?${params}`);
        if (res.ok) {
          const data = await res.json();
          setCalls(data.calls);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      } catch (error) {
        console.error('Failed to fetch calls:', error);
      } finally {
        setLoading(false);
      }
    };

    // デバウンス
    const timer = setTimeout(fetchCalls, 300);
    return () => clearTimeout(timer);
  }, [session, searchQuery, resultFilter, directionFilter, recordingFilter, page, sortBy, sortOrder]);

  // フィルター変更時はページを1に戻す
  useEffect(() => {
    setPage(1);
  }, [searchQuery, resultFilter, directionFilter, recordingFilter]);

  if (status === 'loading') {
    return <FullPageLoading />;
  }

  if (!session) {
    redirect('/login');
  }

  const isAdmin = session.user.role === 'admin';

  const handleExportCSV = () => {
    const headers = ['日時', '担当者', '方向', '電話番号', '結果', '通話時間'];
    const rows = calls.map((call) => [
      format(new Date(call.startTime), 'yyyy-MM-dd HH:mm:ss'),
      call.userName,
      call.direction === 'outbound' ? '発信' : '着信',
      call.phoneNumber,
      resultLabels[call.result],
      formatDuration(call.duration),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `calls_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  return (
    <DashboardLayout
      userRole={session.user.role}
      userName={session.user.name}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">通話履歴</h1>
            <p className="text-gray-600">
              {isAdmin ? '全ユーザーの通話履歴' : '自分の通話履歴'}
            </p>
          </div>
          <Button onClick={handleExportCSV} variant="outline" disabled={calls.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            CSV出力
          </Button>
        </div>

        {/* フィルター */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              検索・フィルター
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="電話番号で検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="結果" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての結果</SelectItem>
                  <SelectItem value="connected">接続</SelectItem>
                  <SelectItem value="no_answer">不在</SelectItem>
                  <SelectItem value="busy">話中</SelectItem>
                  <SelectItem value="voicemail">留守電</SelectItem>
                  <SelectItem value="failed">失敗</SelectItem>
                </SelectContent>
              </Select>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="方向" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての方向</SelectItem>
                  <SelectItem value="outbound">発信</SelectItem>
                  <SelectItem value="inbound">着信</SelectItem>
                </SelectContent>
              </Select>
              <Select value={recordingFilter} onValueChange={setRecordingFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="録音" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべて</SelectItem>
                  <SelectItem value="true">録音あり</SelectItem>
                  <SelectItem value="false">録音なし</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchQuery('');
                  setResultFilter('all');
                  setDirectionFilter('all');
                  setRecordingFilter('all');
                }}
              >
                リセット
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 通話一覧 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Phone className="h-5 w-5" />
              通話一覧（{total}件）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="small" />
              </div>
            ) : calls.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Phone className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>通話履歴がありません</p>
                <p className="text-sm mt-2">Zoom Phoneと同期すると通話データが表示されます</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('startTime')}
                      >
                        <div className="flex items-center">
                          日時
                          <SortIcon field="startTime" />
                        </div>
                      </TableHead>
                      {isAdmin && <TableHead>担当者</TableHead>}
                      <TableHead>電話番号</TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('result')}
                      >
                        <div className="flex items-center">
                          結果
                          <SortIcon field="result" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-gray-50 select-none"
                        onClick={() => handleSort('duration')}
                      >
                        <div className="flex items-center">
                          通話時間
                          <SortIcon field="duration" />
                        </div>
                      </TableHead>
                      <TableHead className="w-12">録音</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calls.map((call) => (
                      <TableRow key={call.id}>
                        <TableCell>
                          {call.direction === 'outbound' ? (
                            <PhoneOutgoing className="h-4 w-4 text-blue-600" />
                          ) : (
                            <PhoneIncoming className="h-4 w-4 text-green-600" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(call.startTime), 'MM/dd HH:mm', {
                            locale: ja,
                          })}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-sm">
                            {call.userName}
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-sm">
                          {call.phoneNumber}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={resultColors[call.result]}
                          >
                            {resultLabels[call.result]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDuration(call.duration)}
                        </TableCell>
                        <TableCell>
                          {call.hasRecording ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 bg-blue-50 hover:bg-blue-100 border-blue-200"
                              onClick={() => handlePlayRecording(call.id, call.recordingId)}
                              disabled={loadingRecording === call.id}
                            >
                              {loadingRecording === call.id ? (
                                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                              ) : playingId === call.id ? (
                                <Pause className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Play className="h-4 w-4 text-blue-600" />
                              )}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {/* ページネーション */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    {total}件中 {(page - 1) * limit + 1} - {Math.min(page * limit, total)}件を表示
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    >
                      最初
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      前へ
                    </Button>
                    <span className="text-sm px-3">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      次へ
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                    >
                      最後
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
