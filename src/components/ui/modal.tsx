'use client';

import { KeyboardEvent, ReactNode, useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /**
   * Optional override for the id used on the `<h2>` title element.
   * The dialog panel automatically wires `aria-labelledby` to this id.
   * When omitted, an id is generated internally via `React.useId()`.
   */
  titleId?: string;
  /**
   * Optional override for the id used on the description `<p>` element.
   * The dialog panel automatically wires `aria-describedby` to this id.
   * When omitted, an id is generated internally via `React.useId()`.
   */
  descriptionId?: string;
}

/**
 * Selector for focusable elements (WAI-ARIA Authoring Practices).
 * Used by the focus-trap to cycle Tab/Shift+Tab inside the dialog panel.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]',
].join(',');

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  className,
  titleId: titleIdProp,
  descriptionId: descriptionIdProp,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const reactId = useId();

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  // Resolve final ids for the title/description elements.
  // Auto-generate via React.useId() when consumer did not provide explicit ids.
  const titleId = title ? titleIdProp ?? `${reactId}-title` : undefined;
  const descriptionId = description
    ? descriptionIdProp ?? `${reactId}-description`
    : undefined;

  // ESC + body-scroll-lock + focus-on-open + focus-return-on-close
  useEffect(() => {
    if (!open) return;

    // Capture the element that was focused before the modal opened,
    // so we can restore focus to it when the modal closes.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) {
      previouslyFocusedRef.current = active;
    } else {
      previouslyFocusedRef.current = null;
    }

    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog after the panel has rendered.
    // rAF defers until the next paint so the focusable elements exist in the DOM.
    const focusTimer = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const firstFocusable = focusables[0];
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        // No focusable children — focus the panel itself so screen readers
        // announce the dialog title/description and keyboard users land somewhere.
        panel.setAttribute('tabindex', '-1');
        panel.focus();
      }
    });

    return () => {
      cancelAnimationFrame(focusTimer);
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';

      // Restore focus to the previously focused element on close/unmount.
      // Guard against stale elements (e.g. unmounted triggers, removed nodes).
      const prev = previouslyFocusedRef.current;
      if (prev && document.body.contains(prev) && typeof prev.focus === 'function') {
        prev.focus();
      }
      previouslyFocusedRef.current = null;
    };
  }, [open, onClose]);

  // Focus trap — cycle Tab/Shift+Tab inside the dialog panel.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

    if (focusables.length === 0) {
      // Nothing to cycle — keep focus on the panel.
      e.preventDefault();
      panel.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      // Shift+Tab from first (or from outside the trap) → wrap to last.
      if (active === first || !panel.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab from last (or from outside the trap) → wrap to first.
      if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md animate-fade-in" />
      <div
        ref={panelRef}
        className={cn(
          'relative w-full rounded-2xl bg-white shadow-elevated animate-slide-up outline-none',
          sizeClasses[size],
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        {(title || description) && (
          <div className="border-b border-gray-100/80 px-6 py-4">
            {title && (
              <h2
                id={titleId}
                className="text-lg font-semibold text-gray-900"
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                id={descriptionId}
                className="mt-0.5 text-sm text-gray-500"
              >
                {description}
              </p>
            )}
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 hover:rotate-90"
          aria-label="Đóng"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Body */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 8rem)' }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}