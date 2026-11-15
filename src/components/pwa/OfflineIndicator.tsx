import React from 'react';
import { CloudUpload, Database, RefreshCw, WifiOff } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useErpData } from '@/src/components/shell/ErpDataProvider';

export function OfflineIndicator() {
  const { syncState } = useErpData();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const showSyncBar =
    !syncState.isOnline || syncState.status === 'syncing' || syncState.pendingCount > 0;

  if (!showSyncBar && !needRefresh) return null;

  return (
    <div className="shrink-0 print:hidden">
      {!syncState.isOnline && (
        <div
          role="status"
          className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 dark:border-amber-800/60 px-4 py-1.5 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-amber-900 dark:text-amber-200"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-[#DC2626] dark:text-[#FACC15]" />
          <span>
            Offline mode active — saving CRM, ledgers & orders locally to IndexedDB (Dexie.js).
          </span>
          {syncState.pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#DC2626]/10 text-[#DC2626] dark:bg-[#FACC15]/15 dark:text-[#FACC15] font-mono text-[11px]">
              <Database className="h-3 w-3" />
              {syncState.pendingCount} {syncState.pendingCount === 1 ? 'batch' : 'batches'} queued
            </span>
          )}
        </div>
      )}

      {syncState.isOnline && (syncState.status === 'syncing' || syncState.pendingCount > 0) && (
        <div
          role="status"
          className="bg-[#FAF9F7] dark:bg-[#1B1417] border-b border-stone-200 dark:border-[#32242A] px-4 py-1.5 flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-[#1C1917] dark:text-stone-100"
        >
          <CloudUpload className="h-3.5 w-3.5 text-[#DC2626] dark:text-[#FACC15] shrink-0" />
          <span>
            {syncState.status === 'syncing'
              ? 'Connection restored — synchronizing offline IndexedDB changes...'
              : `${syncState.pendingCount} offline IndexedDB ${
                  syncState.pendingCount === 1 ? 'change' : 'changes'
                } awaiting sync.`}
          </span>
          {syncState.status !== 'syncing' && (
            <button
              type="button"
              onClick={() => void syncState.triggerSync()}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#DC2626] text-white text-[11px] font-semibold hover:bg-[#B91C1C] cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" />
              Sync Now
            </button>
          )}
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
