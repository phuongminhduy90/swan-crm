'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Service } from '@/lib/types';
import { getAllServices, deactivateService } from '@/lib/firestore';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { formatCurrency } from '@/lib/utils/format';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SERVICE_CATEGORY_LABELS, SERVICE_CATEGORY_COLORS, ALL_SERVICE_CATEGORIES } from '@/constants/service-categories';
import { ServiceCategory } from '@/lib/types';
import { hasPermission } from '@/config/roles';

interface Props {
  refresh?: number;
  onEdit?: (service: Service) => void;
}

export function ServiceListTable({ refresh, onEdit }: Props) {
  const { user } = useCurrentUser();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Service | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const canWrite = !!user && hasPermission(user.role, 'settings:write');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllServices();
      setServices(data);
    } catch (err) {
      console.error('[ServiceList] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refresh]);

  const filtered = services.filter((s) => {
    if (categoryFilter && s.category !== categoryFilter) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, categoryFilter]);

  async function handleDeactivate() {
    if (!confirmDeactivate) return;
    setDeactivating(true);
    try {
      await deactivateService(confirmDeactivate.id);
      setConfirmDeactivate(null);
      await load();
    } catch (err) {
      console.error('[ServiceList] Deactivate error:', err);
    } finally {
      setDeactivating(false);
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Tên dịch vụ',
      render: (row: Service) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'category',
      header: 'Nhóm',
      render: (row: Service) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SERVICE_CATEGORY_COLORS[row.category]}`}>
          {SERVICE_CATEGORY_LABELS[row.category] ?? row.category}
        </span>
      ),
    },
    {
      key: 'defaultPrice',
      header: 'Giá mặc định',
      render: (row: Service) => <span className="text-sm">{row.defaultPrice ? formatCurrency(row.defaultPrice) : '—'}</span>,
    },
    {
      key: 'description',
      header: 'Mô tả',
      render: (row: Service) => <span className="text-sm text-gray-500">{row.description || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32 text-right',
      render: (row: Service) =>
        canWrite ? (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit?.(row); }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-swan-50 hover:text-swan-600"
              aria-label="Chỉnh sửa"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDeactivate(row); }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Ngừng dịch vụ"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên dịch vụ..." />
        </div>
        <div className="w-full sm:w-48">
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">— Tất cả nhóm —</option>
            {ALL_SERVICE_CATEGORIES.map((c: ServiceCategory) => (
              <option key={c} value={c}>{SERVICE_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <DataTable<Record<string, unknown>>
          columns={columns as never}
          data={paged as unknown as Record<string, unknown>[]}
          loading={loading}
          emptyMessage="Không có dịch vụ nào"
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      <ConfirmDialog
        open={!!confirmDeactivate}
        title="Ngừng dịch vụ?"
        description={`Dịch vụ "${confirmDeactivate?.name}" sẽ bị ẩn khỏi danh sách.`}
        confirmLabel="Ngừng dịch vụ"
        variant="danger"
        loading={deactivating}
        onConfirm={handleDeactivate}
        onClose={() => setConfirmDeactivate(null)}
        closeLabel="Đóng hộp thoại ngừng dịch vụ"
      />
    </div>
  );
}