'use client';

import { MouseEvent, forwardRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface CloseIconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-label'> {
  /**
   * Accessible label rendered as `aria-label`. Defaults to Vietnamese "Đóng"
   * to match the existing Modal close affordance.
   */
  ariaLabel?: string;
  /**
   * Click handler. Fires the consumer-provided `onClose` (or `onClick`)
   * callback. The native `MouseEvent` is forwarded so consumers can call
   * `stopPropagation()` (e.g. when the button sits inside a backdrop-click
   * region).
   */
  onClose?: (event: MouseEvent<HTMLButtonElement>) => void;
  /**
   * Optional visual size. `md` (default) renders the existing 32×32 hit area
   * (p-1.5 + 16px icon) that pairs with `Modal` and `ConfirmDialog`.
   */
  size?: 'sm' | 'md';
}

/**
 * Leaf primitive — close affordance for overlays (Modal, ConfirmDialog,
 * Drawer, Sheet). Consolidates the close-X pattern so visual treatment,
 * focus ring, and `aria-label="Đóng"` stay consistent across every
 * dismissible surface.
 *
 * Story A.3 (Sprint 6.1) — see `docs/ux-redesign/SPRINT_6_1_EXECUTION_PLAN.md`
 * §A.3 / §4.1 / §6.2 / §9 commit 3.
 */
export const CloseIconButton = forwardRef<HTMLButtonElement, CloseIconButtonProps>(
  function CloseIconButton(
    {
      ariaLabel = 'Đóng',
      onClose,
      onClick,
      size = 'md',
      className,
      disabled,
      ...rest
    },
    ref,
  ) {
    const sizeClasses =
      size === 'sm'
        ? 'p-1 [&_svg]:h-3.5 [&_svg]:w-3.5'
        : 'p-1.5 [&_svg]:h-4 [&_svg]:w-4';

    return (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={(event) => {
          onClose?.(event);
          if (event.defaultPrevented) return;
          onClick?.(event);
        }}
        className={cn(
          'rounded-lg text-gray-400 transition-all duration-200',
          'hover:bg-gray-100 hover:text-gray-600 hover:rotate-90',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-swan-400 focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:rotate-0',
          sizeClasses,
          className,
        )}
        {...rest}
      >
        <X aria-hidden="true" />
      </button>
    );
  },
);