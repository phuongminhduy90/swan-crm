import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="w-full" style={{ height }} />
    </Card>
  );
}

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <Skeleton className="mt-3 h-4 w-24" />
          <Skeleton className="mt-1 h-7 w-20" />
        </Card>
      ))}
    </div>
  );
}
