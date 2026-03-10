'use client';

import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { UserStatus } from '@/types';
import { Circle, Coffee, Clock, PhoneOff, ChevronDown } from 'lucide-react';

interface StatusSelectorProps {
  currentStatus: UserStatus;
  onStatusChange?: (status: UserStatus) => void;
}

const statusConfig: Record<UserStatus, { label: string; color: string; icon: React.ReactNode }> = {
  available: {
    label: '対応可能',
    color: 'bg-green-500',
    icon: <Circle className="h-3 w-3 fill-green-500 text-green-500" />,
  },
  on_call: {
    label: '通話中',
    color: 'bg-blue-500',
    icon: <Circle className="h-3 w-3 fill-blue-500 text-blue-500" />,
  },
  break: {
    label: '休憩中',
    color: 'bg-amber-500',
    icon: <Coffee className="h-3 w-3 text-amber-500" />,
  },
  away: {
    label: '離席中',
    color: 'bg-gray-400',
    icon: <Clock className="h-3 w-3 text-gray-400" />,
  },
  offline: {
    label: 'オフライン',
    color: 'bg-gray-600',
    icon: <PhoneOff className="h-3 w-3 text-gray-600" />,
  },
};

const selectableStatuses: UserStatus[] = ['available', 'break', 'away', 'offline'];

export function StatusSelector({ currentStatus, onStatusChange }: StatusSelectorProps) {
  const [status, setStatus] = useState<UserStatus>(currentStatus);

  const handleStatusChange = async (newStatus: UserStatus) => {
    setStatus(newStatus);

    // Call API to update status
    try {
      await fetch('/api/users/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChange?.(newStatus);
    } catch (error) {
      console.error('Failed to update status:', error);
      // Revert on error
      setStatus(currentStatus);
    }
  };

  const currentConfig = statusConfig[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2 px-3 py-2 h-auto text-left"
        >
          <div className="flex items-center gap-2">
            {currentConfig.icon}
            <span className="text-sm">{currentConfig.label}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {selectableStatuses.map((statusKey) => {
          const config = statusConfig[statusKey];
          return (
            <DropdownMenuItem
              key={statusKey}
              onClick={() => handleStatusChange(statusKey)}
              className="flex items-center gap-2 cursor-pointer"
            >
              {config.icon}
              <span>{config.label}</span>
              {status === statusKey && (
                <span className="ml-auto text-blue-600">✓</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
