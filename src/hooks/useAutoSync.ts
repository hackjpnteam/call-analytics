'use client';

import { useEffect, useRef } from 'react';

export function useAutoSync() {
  const syncedRef = useRef(false);

  useEffect(() => {
    // 1回だけ実行
    if (syncedRef.current) return;
    syncedRef.current = true;

    // バックグラウンドで同期を実行（UIをブロックしない）
    fetch('/api/sync/auto', { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success && !data.skipped) {
          console.log('Auto sync:', data.message);
          // 同期完了後にページをリロード（新しいデータを表示）
          if (data.stats?.created > 0) {
            window.location.reload();
          }
        }
      })
      .catch(err => console.error('Auto sync failed:', err));
  }, []);
}
