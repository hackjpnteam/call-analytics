'use client';

import { Sidebar } from './sidebar';
import { AutoSync } from '@/components/auto-sync';
import { UserRole, UserStatus } from '@/types';

interface DashboardLayoutProps {
  children: React.ReactNode;
  userRole: UserRole;
  userName: string;
  userStatus?: UserStatus;
}

export function DashboardLayout({
  children,
  userRole,
  userName,
  userStatus = 'available',
}: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-100">
      <AutoSync intervalMinutes={5} />
      <Sidebar userRole={userRole} userName={userName} userStatus={userStatus} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
