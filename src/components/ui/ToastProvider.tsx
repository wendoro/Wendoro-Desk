import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  Info,
  X,
  XCircle,
} from 'lucide-react';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';
export type ToastCategory = 'sync' | 'export' | 'alert' | 'system';

export interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  category?: ToastCategory;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ToastRecord extends ToastInput {
  id: string;
  variant: ToastVariant;
  category: ToastCategory;
  durationMs: number;
  createdAt: number;
}

const MAX_VISIBLE_TOASTS = 4;

export function enqueueToastList(
  current: ToastRecord[],
  next: ToastRecord,
  maxVisible = MAX_VISIBLE_TOASTS,
): ToastRecord[] {
  // Deduplicate identical active toast titles triggered within 2 seconds
  const deduped = current.filter(
    (item) => !(item.title === next.title && next.createdAt - item.createdAt < 2000),
  );
  const combined = [...deduped, next];
  return combined.length > maxVisible ? combined.slice(combined.length - maxVisible) : combined;
}

export function removeToastFromList(current: ToastRecord[], id: string): ToastRecord[] {
  return current.filter((item) => item.id !== id);
}

interface ToastContextValue {
  toasts: ToastRecord[];
  pushToast: (input: ToastInput) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function createToastId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const VARIANT_STYLES: Record<
  ToastVariant,
  {
    accentBar: string;
    iconWrap: string;
    titleText: string;
  }
> = {
  success: {
    accentBar: 'bg-emerald-600 dark:bg-emerald-500',
    iconWrap: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
    titleText: 'text-[#1C1917] dark:text-stone-100',
  },
  info: {
    accentBar: 'bg-[#F59E0B]',
    iconWrap: 'bg-[#FACC15]/20 text-[#92400E] dark:text-[#FACC15]',
    titleText: 'text-[#1C1917] dark:text-stone-100',
  },
  warning: {
    accentBar: 'bg-[#FACC15]',
    iconWrap: 'bg-[#FACC15]/25 text-[#92400E] dark:text-[#FACC15]',
    titleText: 'text-[#1C1917] dark:text-stone-100',
  },
  error: {
    accentBar: 'bg-[#DC2626]',
    iconWrap: 'bg-[#DC2626]/12 text-[#DC2626] dark:text-red-300',
    titleText: 'text-[#DC2626] dark:text-red-300',
  },
};

function ToastIcon({ variant, category }: { variant: ToastVariant; category: ToastCategory }) {
  if (category === 'sync' && variant !== 'error') {
    return <CloudUpload className="h-4 w-4" />;
  }
  if (category === 'export' && variant === 'success') {
    return <Download className="h-4 w-4" />;
  }
  switch (variant) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4" />;
    case 'error':
      return <XCircle className="h-4 w-4" />;
    case 'info':
    default:
      return <Info className="h-4 w-4" />;
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => removeToastFromList(prev, id));
  }, []);

  const clearToasts = useCallback(() => {
    for (const timer of timersRef.current.values()) {
      window.clearTimeout(timer);
    }
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const pushToast = useCallback(
    (input: ToastInput): string => {
      const id = createToastId();
      const durationMs = input.durationMs ?? 4500;
      const record: ToastRecord = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? 'info',
        category: input.category ?? 'system',
        durationMs,
        actionLabel: input.actionLabel,
        onAction: input.onAction,
        createdAt: Date.now(),
      };

      setToasts((prev) => enqueueToastList(prev, record));

      if (durationMs > 0 && typeof window !== 'undefined') {
        const timer = window.setTimeout(() => {
          dismissToast(id);
        }, durationMs);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast],
  );

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        window.clearTimeout(timer);
      }
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ toasts, pushToast, dismissToast, clearToasts }),
    [toasts, pushToast, dismissToast, clearToasts],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Floating Toast Viewport */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-label="Workspace notifications"
          className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2.5 w-[calc(100vw-2rem)] sm:w-96 pointer-events-none print:hidden"
        >
          {toasts.map((toast) => {
            const style = VARIANT_STYLES[toast.variant];
            return (
              <div
                key={toast.id}
                role={toast.variant === 'error' ? 'alert' : 'status'}
                className="pointer-events-auto relative overflow-hidden rounded-xl border border-stone-200 dark:border-[#3A2B31] bg-white/95 dark:bg-[#1B1417]/95 backdrop-blur-md shadow-xl p-3.5 pl-4 flex items-start gap-3 transition-all"
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-0 bottom-0 w-1 ${style.accentBar}`}
                />
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${style.iconWrap}`}
                >
                  <ToastIcon variant={toast.variant} category={toast.category} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-semibold leading-snug ${style.titleText}`}>
                    {toast.title}
                  </div>
                  {toast.description && (
                    <p className="mt-0.5 text-[11px] text-[#57534E] dark:text-stone-400 leading-relaxed break-words">
                      {toast.description}
                    </p>
                  )}
                  {toast.actionLabel && toast.onAction && (
                    <button
                      type="button"
                      onClick={() => {
                        toast.onAction?.();
                        dismissToast(toast.id);
                      }}
                      className="mt-2 inline-flex items-center px-2.5 py-1 rounded-md bg-[#DC2626] text-white text-[11px] font-semibold hover:bg-[#B91C1C] cursor-pointer"
                    >
                      {toast.actionLabel}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss notification"
                  className="p-1 rounded-md text-[#78716C] hover:text-[#1C1917] dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-[#251B20] cursor-pointer shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
