import React, { useState } from 'react';
import { Download, MonitorSmartphone, Share, X } from 'lucide-react';
import { usePWAInstall } from '@/src/hooks/usePWAInstall';

export function PWAInstallButton({ onOpenDeploy }: { onOpenDeploy?: () => void }) {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (!canInstall && !isIOS) {
    if (!onOpenDeploy) return null;
    return (
      <button
        type="button"
        onClick={onOpenDeploy}
        title="Desktop & Android Apps"
        className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-[#32242A] bg-white dark:bg-[#141013] text-xs font-medium text-[#1C1917] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#251B20] cursor-pointer whitespace-nowrap shrink-0"
      >
        <MonitorSmartphone className="h-3.5 w-3.5 text-[#DC2626]" />
        <span>Get App</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isIOS) {
            setShowIOSGuide(true);
          } else {
            void promptInstall();
          }
        }}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#DC2626] text-white text-xs font-medium hover:bg-[#B91C1C] cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1B1417]/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install WENDORO on iOS"
        >
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#1B1417] border border-slate-200 dark:border-[#32242A] p-5 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1C1917] dark:text-slate-100">
                Install WENDORO on iPhone / iPad
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 rounded-md text-[#718096] hover:text-[#1C1917] dark:hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="space-y-2 text-xs text-[#718096] dark:text-slate-300 list-decimal pl-4">
              <li>
                Tap the <Share className="inline h-3.5 w-3.5 text-[#DC2626] mx-0.5" /> Share icon in Safari.
              </li>
              <li>Scroll down and tap <strong className="text-[#1C1917] dark:text-white">Add to Home Screen</strong>.</li>
              <li>Tap <strong className="text-[#1C1917] dark:text-white">Add</strong> to launch WENDORO as a standalone app.</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
