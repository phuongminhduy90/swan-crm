'use client';

import { useState, ReactNode } from 'react';
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
}

export function Tabs({
  items,
  activeId,
  onChange,
  className,
  variant = 'pill',
}: TabsProps) {
  const [internalActive, setInternalActive] = useState(items[0]?.id);
  const active = activeId ?? internalActive;

  function handle(id: string) {
    if (activeId === undefined) setInternalActive(id);
    onChange?.(id);
  }

  if (variant === 'underline') {
    return (
      <div className={cn('flex gap-6 border-b border-gray-200', className)}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handle(item.id)}
            className={cn(
              'group relative pb-3 text-sm font-medium transition-colors',
              active === item.id
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
              className={cn(
                'absolute -bottom-px left-0 h-0.5 w-full rounded-full transition-all duration-300',
                active === item.id ? 'bg-gradient-to-r from-swan-500 to-swan-600' : 'bg-transparent',
              )}
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('inline-flex gap-1 rounded-xl border border-gray-100/80 bg-white p-1 shadow-soft', className)}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => handle(item.id)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
            active === item.id
              ? 'bg-gradient-to-r from-swan-500 to-swan-600 text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-50/80 hover:text-gray-700',
          )}
        >
          {item.icon}
          {item.label}
          {item.badge}
        </button>
      ))}
    </div>
  );
}
