import React, { useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !needRefresh) return null;

  return (
    <div className="shrink-0">
      {!isOnline && (
        <div
          role="status"
          className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800/60 px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-200"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>
            Offline mode active — WENDORO is running locally and saving changes to device storage.
          </span>
        </div>
      )}
      {needRefresh && (
        <div
          role="status"
          className="bg-[#DC2626]/10 dark:bg-[#DC2626]/20 border-b border-[#DC2626]/30 px-4 py-1.5 flex items-center justify-center gap-3 text-xs font-medium text-[#1C1917] dark:text-slate-100"
        >
          <span>A newer version of WENDORO ERP is cached and ready.</span>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#DC2626] text-white text-[11px] font-medium hover:bg-[#B91C1C] cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            Update Now
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="text-[11px] text-[#718096] dark:text-slate-400 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
