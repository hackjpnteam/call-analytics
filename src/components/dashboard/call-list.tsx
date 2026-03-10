'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, PhoneIncoming, PhoneOutgoing, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CallResult, CallDirection } from '@/types';
import { RecordingPlayer } from './recording-player';
import { CustomerInfo } from './customer-info';

interface CallLogItem {
  id: string;
  userId: string;
  userName?: string;
  direction: CallDirection;
  phoneNumber: string;
  result: CallResult;
  startTime: string;
  duration: number;
  hasRecording: boolean;
}

interface CallListProps {
  calls: CallLogItem[];
  showUser?: boolean;
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

export function CallList({ calls, showUser }: CallListProps) {
  const [selectedRecording, setSelectedRecording] = useState<CallLogItem | null>(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const handlePlayRecording = (call: CallLogItem) => {
    setSelectedRecording(call);
    setIsPlayerOpen(true);
  };

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Phone className="h-5 w-5" />
          通話履歴
        </CardTitle>
      </CardHeader>
      <CardContent>
        {calls.length === 0 ? (
          <p className="text-center text-gray-500 py-8">通話履歴がありません</p>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>日時</TableHead>
              {showUser && <TableHead>担当者</TableHead>}
              <TableHead>電話番号</TableHead>
              <TableHead>結果</TableHead>
              <TableHead>通話時間</TableHead>
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
                {showUser && (
                  <TableCell className="text-sm">{call.userName || '不明'}</TableCell>
                )}
                <TableCell>
                  <CustomerInfo phoneNumber={call.phoneNumber}>
                    {call.phoneNumber}
                  </CustomerInfo>
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
                  {call.hasRecording && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handlePlayRecording(call)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>

    <RecordingPlayer
      isOpen={isPlayerOpen}
      onClose={() => setIsPlayerOpen(false)}
      recording={selectedRecording}
    />
    </>
  );
}
