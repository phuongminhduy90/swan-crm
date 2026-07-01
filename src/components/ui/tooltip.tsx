'use client';

import {
  cloneElement,
  isValidElement,
  ReactElement,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils/cn';

export type TooltipPlacement = 'top' | 'bottom';
export type TooltipAlign = 'start' | 'center' | 'end';

export interface TooltipProps {
  /**
   * The trigger element. Must accept a `ref` and the standard
   * `onMouseEnter` / `onMouseLeave` / `onFocus` / `onBlur` events.
   * The wrapper span provided by this primitive supplies the
   * positioning context — the trigger does not need `position: relative`.
   */
  children: ReactElement;
  /** Tooltip body. Plain text or ReactNode. */
  content: ReactNode;
  /** Placement relative to the trigger. Default `'top'`. */
  placement?: TooltipPlacement;
  /** Alignment along the cross axis. Default `'center'`. */
  align?: TooltipAlign;
  /** Stable id for the tooltip element. Auto-generated if omitted. */
  id?: string;
  /** Show delay in ms. Default 120 ms. */
  delay?: number;
  /** Extra className for the tooltip bubble. */
  className?: string;
}

/**
 * Story B.3.2 / S1 — lightweight Tooltip primitive.
 *
 * Built without Radix UI to keep the dependency surface small
 * (CLAUDE.md §Chart Library notes a Radix-free preference). Provides:
 *
 *  - hover (`mouseenter`) + keyboard focus show with configurable delay
 *  - `mouseleave`, `blur`, `Escape`, and click-outside hide
 *  - `aria-describedby` linkage on the trigger while the tooltip is open
 *  - `role="tooltip"` on the bubble for screen-reader announcement
 *  - WCAG-AA contrast bubble (bg-gray-900 / text-white ≈ 16.1:1)
 *
 * Positioning: the trigger and the bubble are wrapped in a
 * `relative inline-block` span so the absolute bubble anchors to the
 * trigger's box, not to a higher ancestor.
 */
export function Tooltip({
  children,
  content,
  placement = 'top',
  align = 'center',
  id,
  delay = 120,
  className,
}: TooltipProps) {
  const autoId = useId();
  const tooltipId = id ?? `tooltip-${autoId}`;
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLParagraphElement | null>(null);

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    cancelTimer();
    timerRef.current = window.setTimeout(() => setOpen(true), delay);
  }, [cancelTimer, delay]);

  const hide = useCallback(() => {
    cancelTimer();
    setOpen(false);
  }, [cancelTimer]);

  // Escape + click outside dismiss while open.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') hide();
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (bubbleRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      hide();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open, hide]);

  useEffect(() => () => cancelTimer(), [cancelTimer]);

  if (!isValidElement(children)) {
    return <>{children}</>;
  }

  type ChildProps = {
    className?: string;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    ref?: React.Ref<HTMLElement>;
  };
  const childProps = children.props as ChildProps;

  function chainHandler<T>(
    prev: ((e: T) => void) | undefined,
    next: (e: T) => void,
  ) {
    return (event: T) => {
      prev?.(event);
      next(event);
    };
  }

  const trigger = cloneElement(children, {
    'aria-describedby': open ? tooltipId : undefined,
    onMouseEnter: chainHandler(childProps.onMouseEnter, show),
    onMouseLeave: chainHandler(childProps.onMouseLeave, hide),
    onFocus: chainHandler(childProps.onFocus, show),
    onBlur: chainHandler(childProps.onBlur, hide),
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const existingRef = childProps.ref;
      if (typeof existingRef === 'function') {
        (existingRef as (n: HTMLElement | null) => void)(node);
      } else if (
        existingRef &&
        typeof existingRef === 'object' &&
        'current' in existingRef
      ) {
        (existingRef as { current: HTMLElement | null }).current = node;
      }
    },
  } as Partial<ChildProps> & Record<string, unknown>);

  return (
    <span className="relative inline-block">
      {trigger}
      <p
        ref={bubbleRef}
        id={tooltipId}
        role="tooltip"
        data-testid="tooltip-bubble"
        hidden={!open}
        className={cn(
          'pointer-events-none absolute z-50 max-w-[240px] rounded-lg bg-gray-900 px-3 py-2 text-left text-xs font-medium leading-snug text-white shadow-medium',
          placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          align === 'start' && 'left-0',
          align === 'center' && 'left-1/2 -translate-x-1/2',
          align === 'end' && 'right-0',
          className,
        )}
      >
        {content}
      </p>
    </span>
  );
}