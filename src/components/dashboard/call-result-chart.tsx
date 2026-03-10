'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CallSummary } from '@/types';

interface CallResultChartProps {
  summary: CallSummary;
}

const COLORS = {
  connected: '#22c55e',    // green
  no_answer: '#f59e0b',    // amber
  busy: '#ef4444',         // red
  voicemail: '#8b5cf6',    // purple
  failed: '#6b7280',       // gray
};

export function CallResultChart({ summary }: CallResultChartProps) {
  const data = [
    { name: '接続', value: summary.connectedCalls, color: COLORS.connected },
    { name: '不在', value: summary.noAnswerCalls, color: COLORS.no_answer },
    { name: '話中', value: summary.busyCalls, color: COLORS.busy },
    { name: '留守電', value: summary.voicemailCalls, color: COLORS.voicemail },
    { name: '失敗', value: summary.failedCalls, color: COLORS.failed },
  ].filter((d) => d.value > 0);

  const connectionRate =
    summary.totalCalls > 0
      ? ((summary.connectedCalls / summary.totalCalls) * 100).toFixed(1)
      : '0';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">通話結果</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value}件`, '']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">接続率</p>
          <p className="text-3xl font-bold text-green-600">{connectionRate}%</p>
        </div>
      </CardContent>
    </Card>
  );
}
