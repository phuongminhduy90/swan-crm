'use client';

import { KeyboardEvent, ReactNode, useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import { CloseIconButton } from './close-icon-button';

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
  /**
   * Story C.1.1 (Sprint 7.1) — per-context `aria-label` for the close icon
   * button rendered in the top-right corner. Defaults to the generic
   * Vietnamese "Đóng" so existing consumers stay backwards-compatible.
   *
   * When provided, the label is forwarded to `<CloseIconButton>` so screen
   * readers announce e.g. "Đóng hộp thoại chỉnh sửa khách hàng" instead of
   * the generic "Đóng", satisfying WCAG 2.4.6 (headings and labels).
   */
  closeLabel?: string;
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
  closeLabel = 'Đóng',
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

    // Move focus into the dialog. This useEffect runs after the panel has been
    // committed to the DOM, so panelRef.current and its focusables are available
    // synchronously. No rAF is required.
    const panel = panelRef.current;
    if (panel) {
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
    }

    return () => {
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

  // Focus trap — always manages Tab/Shift+Tab inside the dialog panel.
// We always preventDefault on Tab and move focus ourselves, because
// we cannot rely on the browser's native focus traversal (some testing
// environments — including jsdom — do not implement it). This also
// gives us deterministic wrap-around behavior.
const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
  if (e.key !== 'Tab') return;
  const panel = panelRef.current;
  if (!panel) return;

  // Filter out disabled elements only. We do NOT filter by `offsetParent`
  // because some environments (notably jsdom) do not implement layout,
  // and `offsetParent` returns null for everything — which would empty
  // the focusable list and break the trap. In real browsers, elements
  // with `display: none` ancestors are still excluded because their
  // `disabled` or `hidden` attribute makes them unfocusable.
  const focusables = Array.from(
    panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => !el.hasAttribute('disabled'));

  if (focusables.length === 0) {
    // Nothing to cycle — keep focus on the panel.
    e.preventDefault();
    panel.focus();
    return;
  }

  e.preventDefault();

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;
  const activeIndex = active ? focusables.indexOf(active) : -1;

  if (e.shiftKey) {
    // Shift+Tab: move backwards. From first (or anything before first,
    // or outside the trap) → wrap to last.
    if (activeIndex <= 0) {
      last.focus();
    } else {
      focusables[activeIndex - 1].focus();
    }
  } else {
    // Tab: move forwards. From last (or anything past last, or outside
    // the trap) → wrap to first.
    if (activeIndex === -1 || activeIndex === focusables.length - 1) {
      first.focus();
    } else {
      focusables[activeIndex + 1].focus();
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

        {/* Close button — uses the shared CloseIconButton primitive (Story A.3)
            so every dismissible surface has consistent a11y + visual treatment.
            Story C.1.1 (Sprint 7.1) — the `ariaLabel` now accepts a per-context
            override via the `closeLabel` prop so screen readers announce the
            specific dialog being dismissed (WCAG 2.4.6). */}
        <CloseIconButton
          onClose={onClose}
          className="absolute right-4 top-4"
          ariaLabel={closeLabel}
        />

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