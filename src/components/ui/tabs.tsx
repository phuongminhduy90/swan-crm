'use client';

import { KeyboardEvent, ReactNode, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  activeId?: string;
  onChange?: (id: string) => void;
  className?: string;
  variant?: 'pill' | 'underline';
  /**
   * Optional id used as the basis for tab/panel element ids. The component
   * generates a stable id from `useId()` when omitted. Consumers wire their
   * tabpanels with `aria-labelledby={id(tabId)}` to complete the WAI-ARIA tabs
   * pattern.
   */
  idPrefix?: string;
  /**
   * Tab ids that have a corresponding `role="tabpanel"` element rendered by
   * the consumer. When provided, `aria-controls` is emitted for those tabs
   * only — keeping the WAI-ARIA tabs pattern conformant (axe-core rejects
   * `aria-controls` values that don't resolve to an in-DOM element).
   *
   * Default: all tab ids are treated as having panels. Consumers that don't
   * render tabpanels should pass an empty array (or omit the prop) to suppress
   * `aria-controls` entirely.
   */
  panelIds?: string[];
}

/**
 * Accessible tabs primitive.
 *
 * Implements the WAI-ARIA Authoring Practices "Tabs with Manual Activation"
 * pattern:
 * - Container exposes `role="tablist"` with `aria-orientation="horizontal"`.
 * - Each tab exposes `role="tab"`, `aria-selected`, `aria-controls`, and a
 *   roving `tabIndex` (only the active tab is tabbable).
 * - ArrowLeft / ArrowRight cycle focus + selection; Home / End jump to first /
 *   last. Activation on focus is enabled because every tab is "always
 *   rendered" (panels are conditional on the consumer side); deferring
 *   activation avoids stale focus on hidden panels.
 * - Tabpanels are rendered by the consumer; they should set
 *   `role="tabpanel"` + `aria-labelledby={id(tabId)}` to round out the
 *   relationship.
 */
export function Tabs({
  items,
  activeId,
  onChange,
  className,
  variant = 'pill',
  idPrefix,
  panelIds,
}: TabsProps) {
  const generatedPrefix = `tabs-${useId().replace(/:/g, '')}`;
  const prefix = idPrefix ?? generatedPrefix;
  const [internalActive, setInternalActive] = useState(items[0]?.id);
  const active = activeId ?? internalActive;
  const tabRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  // When `panelIds` is omitted, default to "all tabs have a panel" — matching
  // the common case where consumers always render every panel (just hide the
  // inactive ones with display:none / conditional rendering). When `panelIds`
  // is explicitly provided (including `[]`), honor it verbatim so consumers
  // without panels can opt out.
  const panelsEnabled = panelIds ?? items.map((item) => item.id);
  const hasPanel = (id: string) => panelsEnabled.includes(id);

  function select(id: string) {
    if (activeId === undefined) setInternalActive(id);
    onChange?.(id);
  }

  function focusTab(id: string) {
    const node = tabRefs.current.get(id);
    node?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentId: string) {
    const index = items.findIndex((item) => item.id === currentId);
    if (index === -1) return;

    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % items.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + items.length) % items.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = items.length - 1;
        break;
      default:
        return;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextItem = items[nextIndex];
    if (!nextItem) return;
    select(nextItem.id);
    focusTab(nextItem.id);
  }

  function tabButtonProps(item: TabItem) {
    const isActive = active === item.id;
    const props: {
      ref: (node: HTMLButtonElement | null) => void;
      id: string;
      'aria-selected': boolean;
      tabIndex: number;
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
      'aria-controls'?: string;
    } = {
      ref: (node) => {
        tabRefs.current.set(item.id, node);
      },
      id: `${prefix}-tab-${item.id}`,
      'aria-selected': isActive,
      tabIndex: isActive ? 0 : -1,
      onKeyDown: (event) => onKeyDown(event, item.id),
    };
    if (hasPanel(item.id)) {
      props['aria-controls'] = `${prefix}-panel-${item.id}`;
    }
    return props;
  }

  if (variant === 'underline') {
    return (
      <div
        role="tablist"
        aria-orientation="horizontal"
        className={cn('flex gap-6 border-b border-gray-200', className)}
      >
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              {...tabButtonProps(item)}
              onClick={() => select(item.id)}
              className={cn(
                'group relative pb-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-swan-400 focus-visible:ring-offset-2',
                isActive
                  ? 'text-swan-700'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              <span className="flex items-center gap-2">
                {item.icon}
                {item.label}
                {item.badge}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -bottom-px left-0 h-0.5 w-full rounded-full transition-all duration-300',
                  isActive ? 'bg-gradient-to-r from-swan-500 to-swan-600' : 'bg-transparent',
                )}
              />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        'inline-flex gap-1 rounded-xl border border-gray-100/80 bg-white p-1 shadow-soft',
        className,
      )}
    >
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            {...tabButtonProps(item)}
            onClick={() => select(item.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-swan-400 focus-visible:ring-offset-2',
              isActive
                ? 'bg-gradient-to-r from-swan-500 to-swan-600 text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-50/80 hover:text-gray-700',
            )}
          >
            {item.icon}
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}