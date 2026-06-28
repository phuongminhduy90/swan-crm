import { Construction } from 'lucide-react';

interface PlaceholderPageProps {
  title: string;
  description?: string;
  phase?: string;
}

export function PlaceholderPage({ title, description, phase = 'Phase tiếp theo' }: PlaceholderPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-swan-50">
          <Construction className="h-7 w-7 text-swan-500" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Đang phát triển</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          Trang này sẽ được xây dựng ở {phase}. Cấu trúc dữ liệu và giao diện sẽ theo đặc tả CRM SWAN.
        </p>
      </div>
    </div>
  );
}