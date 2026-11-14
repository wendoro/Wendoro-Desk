import React from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export function LoadingState({
  rows = 5,
  label = 'Loading workspace records...',
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className="space-y-3 py-2">
      <div className="h-9 w-full rounded-lg bg-slate-100 dark:bg-[#162342] animate-pulse" />
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-10 w-full rounded-lg bg-slate-100/70 dark:bg-[#162342]/70 animate-pulse"
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-slate-200 dark:border-[#223257] rounded-xl bg-slate-50/50 dark:bg-[#0E172E]">
      <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-[#162342] flex items-center justify-center text-[#718096] dark:text-slate-400 mb-3">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-[#182238] dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-1 text-sm text-[#718096] dark:text-slate-400 max-w-md">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Unable to load data',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div>
          <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
            {title}
          </h3>
          <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </Button>
      )}
    </div>
  );
}
