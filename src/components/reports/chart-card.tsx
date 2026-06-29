import { ReactNode } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

interface ChartCardProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
  minHeight?: number;
}

export function ChartCard({ title, icon, action, className, children, minHeight = 300 }: ChartCardProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 mb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <div className="flex-1" style={{ minHeight }}>
        {children}
      </div>
    </Card>
  );
}
