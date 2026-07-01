'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  ReactNode,
  Dispatch,
  SetStateAction,
  MutableRefObject,
} from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ToastType = 'success' | 'error' | 'info';

/**
 * Story TD-2 (Sprint 7.1) — extended Toast options for the new object
 * overload. All fields are optional so callers can pass a single `title`
 * (same UX as the legacy `(message, type)` form) or a full options bag.
 *
 * `title` is the equivalent of the old `message` argument. `description`
 * renders below the title in muted copy and is purely additive — the
 * legacy single-line UX is preserved when `description` is omitted.
 *
 * `duration` is in milliseconds. The legacy default is `3500`; pass `0`
 * for a sticky toast (no auto-dismiss, only manual close via the X button
 * or programmatic dismissal — useful when the toast hosts a destructive
 * CTA the user must explicitly resolve).
 *
 * `action` renders a labelled CTA button on the right of the toast. The
 * action click does NOT auto-dismiss so consumers stay in control of the
 * post-action flow. Consumers that want to audit the action can wrap
 * `action.onClick` with `writeAuditLog()` from `@/lib/firestore/audit` —
 * ToastProvider stays pure (no audit side-effects) so it can be mounted
 * in tests without a Firestore backing.
 */
export interface ToastOptions {
  title?: string;
  description?: string;
  type?: ToastType;
  /** Auto-dismiss delay in milliseconds. Default: 3500. Use `0` for sticky. */
  duration?: number;
  /** Optional right-aligned CTA. */
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastItem {
  id: number;
  type: ToastType;
  /** Always present after TD-2 — either the legacy `message` or the new `title`. */
  title: string;
  description?: string;
  /** `0` means sticky; any positive number is the auto-dismiss delay in ms. */
  duration: number;
  action?: ToastOptions['action'];
}

/**
 * The full overloaded `toast` callable. Both signatures are preserved at
 * the type level:
 *
 *   toast('Lưu thành công')              // legacy single-arg, info type
 *   toast('Lỗi mạng', 'error')           // legacy message + type
 *   toast({ title: '...', description, type, duration, action })  // new
 */
type ToastFunction = {
  (message: string, type?: ToastType): void;
  (options: ToastOptions): void;
};

interface ToastContextValue {
  toast: ToastFunction;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 3500;

let nextId = 0;

type ToastSetter = Dispatch<SetStateAction<ToastItem[]>>;
type ToastTimersRef = MutableRefObject<Map<number, ReturnType<typeof setTimeout>>>;

/**
 * Build a `toast` function with the overloaded signature. Extracted as a
 * module-level helper so the closure's dependencies are explicit (clean
 * `react-hooks/exhaustive-deps` analysis — wrapping the inline function
 * literal in `useCallback` would hide the dependencies behind a type
 * cast and trigger a lint warning).
 */
function buildToast(setToasts: ToastSetter, timersRef: ToastTimersRef): ToastFunction {
  const fn = (arg1: string | ToastOptions, arg2?: ToastType) => {
    const id = nextId++;

    let item: ToastItem;
    if (typeof arg1 === 'string') {
      // Legacy `(message, type)` signature — preserved verbatim.
      const message = arg1;
      const type: ToastType = arg2 ?? 'info';
      item = {
        id,
        type,
        title: message,
        duration: DEFAULT_DURATION,
      };
    } else {
      // New `{ ... }` signature — full options bag.
      const options = arg1;
      if (options.title === undefined && options.description === undefined) {
        // Defensive: refuse no-op toasts that would render an empty box.
        // Consumers should pass at least one of `title` or `description`.
        // Fall back to a Vietnamese "Thông báo" title so we never render
        // an unreadable empty toast surface.
        item = {
          id,
          type: options.type ?? 'info',
          title: 'Thông báo',
          description: options.description,
          duration: options.duration ?? DEFAULT_DURATION,
          action: options.action,
        };
      } else {
        item = {
          id,
          type: options.type ?? 'info',
          title: options.title ?? '',
          description: options.description,
          duration: options.duration ?? DEFAULT_DURATION,
          action: options.action,
        };
      }
    }

    // Skip the auto-dismiss timer entirely when `duration === 0`
    // (sticky toast). The X button still dismisses — see `dismiss`.
    if (item.duration > 0) {
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, item.duration);
      timersRef.current.set(id, timer);
    }

    setToasts((prev) => [...prev, item]);
  };
  return fn as ToastFunction;
}

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  info: <Info className="h-4 w-4 text-swan-500" />,
};

const barColors: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-swan-500',
};

const bgColors: Record<ToastType, string> = {
  success: 'border-emerald-100',
  error: 'border-red-100',
  info: 'border-swan-100',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Hold timers by toast id so they can be cancelled when the user
  // manually dismisses (the X button or a programmatic dismiss before
  // the auto-dismiss fires).
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Build the `toast` function once. `buildToast` is a module-level helper
  // with explicit dependencies (setToasts + timersRef), so the memo deps
  // are straightforward and don't trigger the exhaustive-deps lint warning
  // that wrapping an inline cast in `useCallback` would.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const toast = useMemo(() => buildToast(setToasts, timersRef), [setToasts]);

  // Clear any in-flight timers on unmount — keeps tests deterministic
  // and prevents stray setState calls if a provider remounts mid-show.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const hasBody = t.description || t.action;
          return (
            <div
              key={t.id}
              data-testid="toast"
              data-toast-type={t.type}
              data-toast-sticky={t.duration === 0 ? 'true' : 'false'}
              role={t.type === 'error' ? 'alert' : 'status'}
              aria-live={t.type === 'error' ? 'assertive' : 'polite'}
              className={cn(
                'pointer-events-auto relative flex items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-elevated animate-slide-up max-w-sm',
                bgColors[t.type],
              )}
            >
              <span className="mt-0.5 flex-shrink-0">{icons[t.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">
                  {t.title}
                </div>
                {hasBody && (
                  <>
                    {t.description && (
                      <div
                        data-testid="toast-description"
                        className="mt-0.5 text-xs text-gray-500 break-words"
                      >
                        {t.description}
                      </div>
                    )}
                    {t.action && (
                      <button
                        type="button"
                        data-testid="toast-action"
                        onClick={t.action.onClick}
                        className="mt-1.5 inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium text-swan-700 hover:bg-swan-50 hover:text-swan-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-swan-400 focus-visible:ring-offset-1"
                      >
                        {t.action.label}
                      </button>
                    )}
                  </>
                )}
              </div>
              <button
                type="button"
                data-testid="toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Đóng thông báo"
                className="flex-shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-swan-400 focus-visible:ring-offset-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {/* Auto-dismiss progress bar — hidden for sticky toasts. */}
              {t.duration > 0 && (
                <div className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden rounded-b-xl">
                  <div
                    className={cn('h-full w-full animate-shrink', barColors[t.type])}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
