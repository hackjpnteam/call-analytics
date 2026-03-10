'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Phone,
  Users,
  Settings,
  BarChart3,
  LogOut,
  Headphones,
  LineChart,
  Trophy,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { UserRole, UserStatus } from '@/types';
import { cn } from '@/lib/utils';
import { StatusSelector } from './status-selector';

interface SidebarProps {
  userRole: UserRole;
  userName: string;
  userStatus?: UserStatus;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'ダッシュボード',
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    href: '/calls',
    label: '通話履歴',
    icon: <Phone className="h-5 w-5" />,
  },
  {
    href: '/admin',
    label: '管理者ダッシュボード',
    icon: <BarChart3 className="h-5 w-5" />,
    adminOnly: true,
  },
  {
    href: '/admin/analytics',
    label: '分析',
    icon: <LineChart className="h-5 w-5" />,
    adminOnly: true,
  },
  {
    href: '/admin/ranking',
    label: 'ランキング',
    icon: <Trophy className="h-5 w-5" />,
    adminOnly: true,
  },
  {
    href: '/admin/users',
    label: 'ユーザー管理',
    icon: <Users className="h-5 w-5" />,
    adminOnly: true,
  },
  {
    href: '/admin/settings',
    label: '設定',
    icon: <Settings className="h-5 w-5" />,
    adminOnly: true,
  },
];

export function Sidebar({ userRole, userName, userStatus = 'available' }: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || userRole === 'admin'
  );

  return (
    <div className="flex h-screen w-64 flex-col bg-gray-900 text-white">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <Headphones className="h-8 w-8 text-blue-400" />
          <h1 className="text-xl font-bold">Call Analytics</h1>
        </div>
      </div>

      <Separator className="bg-gray-700" />

      <nav className="flex-1 p-4 space-y-1">
        {filteredItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <Separator className="bg-gray-700" />

      <div className="p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-sm font-medium">
              {userName.charAt(0)}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-gray-400">
              {userRole === 'admin' ? '管理者' : 'オペレーター'}
            </p>
          </div>
        </div>
        <div className="mb-3 -ml-2">
          <StatusSelector currentStatus={userStatus} />
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="h-5 w-5 mr-3" />
          ログアウト
        </Button>
      </div>
    </div>
  );
}
