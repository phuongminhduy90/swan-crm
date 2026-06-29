'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pencil, MapPin, PowerOff, CheckCircle } from 'lucide-react';
import { TreatmentLocation } from '@/lib/types';
import { getAllTreatmentLocations, updateTreatmentLocation } from '@/lib/firestore';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Select } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  LOCATION_TYPE_LABELS,
  LOCATION_TYPE_COLORS,
  ALL_LOCATION_TYPES,
} from '@/lib/validators/treatment-location';
import type { TreatmentLocationType } from '@/lib/types';
import { hasPermission } from '@/config/roles';

interface Props {
  refresh?: number;
  onEdit?: (location: TreatmentLocation) => void;
}

export function LocationListTable({ refresh, onEdit }: Props) {
  const { user } = useCurrentUser();
  const [locations, setLocations] = useState<TreatmentLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [confirmDeactivate, setConfirmDeactivate] = useState<TreatmentLocation | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const canWrite = !!user && hasPermission(user.role, 'settings:write');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllTreatmentLocations();
      setLocations(data);
    } catch (err) {
      console.error('[LocationList] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, refresh]);

  const filtered = locations.filter((l) => {
    if (typeFilter && l.type !== typeFilter) return false;
    if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, typeFilter]);

  async function handleDeactivate() {
    if (!confirmDeactivate) return;
    setDeactivating(true);
    try {
      // Toggle: deactivate if active, activate if inactive
      await updateTreatmentLocation(confirmDeactivate.id, {
        active: !confirmDeactivate.active,
        updatedAt: new Date().toISOString(),
      });
      setConfirmDeactivate(null);
      await load();
    } catch (err) {
      console.error('[LocationList] Deactivate/Activate error:', err);
    } finally {
      setDeactivating(false);
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Tên địa điểm',
      render: (row: TreatmentLocation) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-swan-50">
            <MapPin className="h-4 w-4 text-swan-600" />
          </div>
          <span className="font-medium text-gray-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Loại',
      render: (row: TreatmentLocation) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${LOCATION_TYPE_COLORS[row.type]}`}>
          {LOCATION_TYPE_LABELS[row.type] ?? row.type}
        </span>
      ),
    },
    {
      key: 'address',
      header: 'Địa chỉ',
      render: (row: TreatmentLocation) => <span className="text-sm text-gray-500">{row.address || '—'}</span>,
    },
    {
      key: 'contactPerson',
      header: 'Người liên hệ',
      render: (row: TreatmentLocation) => <span className="text-sm text-gray-500">{row.contactPerson || '—'}</span>,
    },
    {
      key: 'contactPhone',
      header: 'SĐT',
      render: (row: TreatmentLocation) => <span className="text-sm text-gray-500">{row.contactPhone || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32 text-right',
      render: (row: TreatmentLocation) =>
        canWrite ? (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit?.(row); }}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-swan-50 hover:text-swan-600"
              aria-label="Chỉnh sửa"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {row.active ? (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeactivate(row); }}
                className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Ngưng hoạt động"
                title="Ngưng hoạt động"
              >
                <PowerOff className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeactivate(row); }}
                className="rounded-lg p-1.5 text-green-500 hover:bg-green-50 hover:text-green-700"
                aria-label="Kích hoạt"
                title="Kích hoạt"
              >
                <CheckCircle className="h-4 w-4" />
            </button>
            )}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên địa điểm..." />
        </div>
        <div className="w-full sm:w-48">
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">— Tất cả loại —</option>
            {ALL_LOCATION_TYPES.map((t: TreatmentLocationType) => (
              <option key={t} value={t}>{LOCATION_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <DataTable<Record<string, unknown>>
          columns={columns as never}
          data={paged as unknown as Record<string, unknown>[]}
          loading={loading}
          emptyMessage="Không có địa điểm nào"
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      <ConfirmDialog
        open={!!confirmDeactivate}
        title={confirmDeactivate?.active ? 'Ngừng địa điểm?' : 'Kích hoạt địa điểm?'}
        description={
          confirmDeactivate?.active
            ? `Địa điểm "${confirmDeactivate?.name}" sẽ bị ẩn khỏi danh sách.`
            : `Địa điểm "${confirmDeactivate?.name}" sẽ được kích hoạt trở lại.`
        }
        confirmLabel={confirmDeactivate?.active ? 'Ngừng hoạt động' : 'Kích hoạt'}
        variant={confirmDeactivate?.active ? 'danger' : 'default'}
        loading={deactivating}
        onConfirm={handleDeactivate}
        onClose={() => setConfirmDeactivate(null)}
      />
    </div>
  );
}
