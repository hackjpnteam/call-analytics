'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DailyChartProps {
  data: {
    date: string;
    totalCalls: number;
    connectedCalls: number;
    totalDuration: number;
  }[];
}

export function DailyChart({ data }: DailyChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">日別通話数</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
                }}
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    totalCalls: '総通話数',
                    connectedCalls: '接続数',
                  };
                  return [`${value}件`, labels[name as string] || name];
                }}
              />
              <Area
                type="monotone"
                dataKey="totalCalls"
                stackId="1"
                stroke="#3b82f6"
                fill="#93c5fd"
                name="totalCalls"
              />
              <Area
                type="monotone"
                dataKey="connectedCalls"
                stackId="2"
                stroke="#22c55e"
                fill="#86efac"
                name="connectedCalls"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
