'use client';

import { useEffect, useRef } from 'react';

interface AutoSyncProps {
  intervalMinutes?: number;
  onSync?: () => void;
}

export function AutoSync({ intervalMinutes = 5, onSync }: AutoSyncProps) {
  const lastSyncRef = useRef<Date | null>(null);

  useEffect(() => {
    const sync = async () => {
      try {
        const res = await fetch('/api/cron/sync', { method: 'POST' });
        if (res.ok) {
          lastSyncRef.current = new Date();
          console.log(`[AutoSync] Synced at ${lastSyncRef.current.toISOString()}`);
          onSync?.();
        }
      } catch (err) {
        console.error('[AutoSync] Failed:', err);
      }
    };

    // Initial sync after 10 seconds
    const initialTimeout = setTimeout(sync, 10000);

    // Periodic sync
    const interval = setInterval(sync, intervalMinutes * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [intervalMinutes, onSync]);

  return null;
}
