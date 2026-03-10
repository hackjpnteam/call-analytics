'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type Period = 'daily' | 'weekly' | 'monthly';

interface PeriodTabsProps {
  value: Period;
  onChange: (value: Period) => void;
}

export function PeriodTabs({ value, onChange }: PeriodTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as Period)}>
      <TabsList>
        <TabsTrigger value="daily">日次</TabsTrigger>
        <TabsTrigger value="weekly">週次</TabsTrigger>
        <TabsTrigger value="monthly">月次</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
