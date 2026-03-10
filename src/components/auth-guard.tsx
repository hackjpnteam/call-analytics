'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { UserRole } from '@/types';
import { FullPageLoading } from '@/components/ui/loading-spinner';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/login');
      return;
    }

    if (requiredRole && session.user.role !== requiredRole) {
      router.push('/');
    }
  }, [session, status, requiredRole, router]);

  if (status === 'loading') {
    return <FullPageLoading />;
  }

  if (!session) {
    return null;
  }

  if (requiredRole && session.user.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
