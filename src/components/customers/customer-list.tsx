'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Trash2, Users, Clock, XCircle } from 'lucide-react';
import {
  getAllCustomers, requestCustomerDeletion, approveCustomerDeletion, rejectCustomerDeletion,
} from '@/lib/firestore';
import { getAllUsers } from '@/lib/firestore/users';
import { Customer, CustomerSource, PrivacyLevel, User as UserType } from '@/lib/types';
import { DataTable } from '@/components/ui/data-table';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { formatDateVN, formatPhone } from '@/lib/utils/format';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/config/roles';
import { useToast } from '@/components/ui/toast';
import { DELETE_APPROVE_ROLES } from '@/constants/permissions';

// ─── Constants ──────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<CustomerSource, string> = {
  online: 'Online',
  offline: 'Offline',
  walk_in: 'Đến trực tiếp',
  referral: 'Giới thiệu',
  koc: 'KOC/KOL',
  old_data: 'Dữ liệu cũ',
  other: 'Khác',
};

const PRIVACY_LEVEL_CONFIG: Record<
  PrivacyLevel,
  { label: string; variant: 'default' | 'gold' | 'danger' }
> = {
  normal: { label: 'Bình thường', variant: 'default' },
  vip: { label: 'VIP', variant: 'gold' },
  highly_sensitive: { label: 'Nhạy cảm cao', variant: 'danger' },
};

const PAGE_SIZE = 10;

interface Props {
  refresh?: number;
  onEdit?: (customer: Customer) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CustomerList({ refresh, onEdit }: Props) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Delete / approval state
  const [requestDelete, setRequestDelete] = useState<Customer | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [requesting, setRequesting] = useState(false);

  const [confirmApprove, setConfirmApprove] = useState<Customer | null>(null);
  const [approving, setApproving] = useState(false);

  const [confirmReject, setConfirmReject] = useState<Customer | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const canWrite = !!user && hasPermission(user.role, 'customers:write');
  const canDeleteApprove = !!user && DELETE_APPROVE_ROLES.includes(user.role);

  const usersMap = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers]);
  const getUserName = useCallback(
    (id: string | undefined) => {
      if (!id) return '—';
      return usersMap.get(id)?.displayName ?? id;
    },
    [usersMap],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [customersData, usersData] = await Promise.all([
        getAllCustomers(),
        getAllUsers(),
      ]);
      setCustomers(customersData);
      setAllUsers(usersData);
    } catch (err) {
      console.error('[CustomerList] Failed to load customers:', err);
      toast('Không thể tải danh sách khách hàng', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.customerCode ?? '').toLowerCase().includes(q),
    );
  }, [customers, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [searchQuery]);

  // Request deletion (sales users)
  async function handleRequestDelete() {
    if (!requestDelete || !user) return;
    setRequesting(true);
    try {
      await requestCustomerDeletion(requestDelete.id, requestReason, user.id);
      toast('Đã gửi yêu cầu xóa khách hàng. Chờ quản lý phê duyệt.', 'info');
      setRequestDelete(null);
      setRequestReason('');
      await load();
    } catch (err) {
      toast('Không thể gửi yêu cầu xóa', 'error');
    } finally {
      setRequesting(false);
    }
  }

  // Approve deletion (CS/CEO/master_sales)
  async function handleApproveDelete() {
    if (!confirmApprove || !user) return;
    setApproving(true);
    try {
      await approveCustomerDeletion(confirmApprove.id, user.id);
      toast(`Đã phê duyệt xóa khách hàng ${confirmApprove.fullName}`, 'success');
      setConfirmApprove(null);
      await load();
    } catch (err) {
      toast('Không thể phê duyệt xóa', 'error');
    } finally {
      setApproving(false);
    }
  }

  // Reject deletion
  async function handleRejectDelete() {
    if (!confirmReject) return;
    setRejecting(true);
    try {
      await rejectCustomerDeletion(confirmReject.id);
      toast('Đã từ chối yêu cầu xóa', 'info');
      setConfirmReject(null);
      await load();
    } catch (err) {
      toast('Không thể từ chối yêu cầu', 'error');
    } finally {
      setRejecting(false);
    }
  }

  const columns = [
    {
      key: 'customerCode',
      header: 'Mã KH',
      className: 'whitespace-nowrap font-mono text-xs',
      render: (row: Customer) => (
        <span className="rounded-md bg-swan-50 px-2 py-1 text-xs font-semibold text-swan-700">
          {row.customerCode ?? '—'}
        </span>
      ),
    },
    {
      key: 'fullName',
      header: 'Họ tên',
      render: (row: Customer) => (
        <div>
          <Link
            href={`/customers/${row.id}`}
            className="font-medium text-gray-900 hover:text-swan-600 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {row.fullName}
          </Link>
          {row.deletionRequested && (
            <Badge variant="danger" className="ml-2">Chờ xóa</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Điện thoại',
      className: 'whitespace-nowrap tabular-nums',
      render: (row: Customer) => (
        <span className="text-gray-600">{formatPhone(row.phone)}</span>
      ),
    },
    {
      key: 'source',
      header: 'Nguồn',
      render: (row: Customer) => (
        <span className="text-sm text-gray-600">
          {row.source ? (SOURCE_LABELS[row.source] ?? row.source) : '—'}
        </span>
      ),
    },
    {
      key: 'privacyLevel',
      header: 'Mức riêng tư',
      render: (row: Customer) => {
        const cfg = PRIVACY_LEVEL_CONFIG[row.privacyLevel];
        return cfg ? (
          <Badge variant={cfg.variant}>{cfg.label}</Badge>
        ) : (
          <span className="text-gray-400">—</span>
        );
      },
    },
    {
      key: 'createdBy',
      header: 'Nhân viên tạo',
      render: (row: Customer) => (
        <span className="text-sm text-gray-600">{getUserName(row.createdBy)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      className: 'whitespace-nowrap text-sm text-gray-500',
      render: (row: Customer) => formatDateVN(row.createdAt),
    },
    ...(canWrite
      ? [
          {
            key: 'actions',
            header: '',
            className: 'w-12 text-right',
            render: (row: Customer) => {
              const dropdownItems: Array<{ label: string; icon: React.ReactNode; onClick: () => void; variant?: 'default' | 'danger'; disabled?: boolean }> = [
                {
                  label: 'Chỉnh sửa',
                  icon: <Pencil className="h-3.5 w-3.5" />,
                  onClick: () => onEdit?.(row),
                },
              ];

              if (row.deletionRequested && canDeleteApprove) {
                // Show approve/reject for pending deletions
                dropdownItems.push(
                  {
                    label: 'Phê duyệt xóa',
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                    variant: 'danger' as const,
                    onClick: () => setConfirmApprove(row),
                  },
                  {
                    label: 'Từ chối xóa',
                    icon: <XCircle className="h-3.5 w-3.5" />,
                    onClick: () => setConfirmReject(row),
                  },
                );
              } else if (row.deletionRequested && canWrite) {
                // Pending delete - no action for this user
                dropdownItems.push({
                  label: 'Đang chờ phê duyệt',
                  icon: <Clock className="h-3.5 w-3.5" />,
                  disabled: true,
                  onClick: () => {},
                });
              } else if (canWrite) {
                // Normal delete request
                dropdownItems.push({
                  label: 'Yêu cầu xóa',
                  icon: <Trash2 className="h-3.5 w-3.5" />,
                  variant: 'danger' as const,
                  onClick: () => setRequestDelete(row),
                });
              }

              return (
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu
                    align="right"
                    trigger={
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-gray-100">
                        <span className="text-base leading-none">⋯</span>
                      </span>
                    }
                    items={dropdownItems}
                  />
                </div>
              );
            },
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Tìm theo tên, SĐT, mã KH..."
          className="max-w-sm"
        />
        {!loading && (
          <p className="text-sm text-gray-500">
            {filtered.length} khách hàng
          </p>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={paginated}
        keyField="id"
        loading={loading}
        emptyMessage={
          searchQuery
            ? `Không tìm thấy khách hàng nào khớp với "${searchQuery}"`
            : 'Chưa có khách hàng nào'
        }
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(row) => router.push(`/customers/${row.id}`)}
      />

      {!loading && filtered.length === 0 && !searchQuery && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Users className="mb-4 h-12 w-12 opacity-30" />
          <p className="text-base font-medium">Chưa có khách hàng nào</p>
          <p className="mt-1 text-sm">Thêm khách hàng đầu tiên để bắt đầu</p>
        </div>
      )}

      {/* Request Delete Dialog (for sales users) */}
      <ConfirmDialog
        open={!!requestDelete}
        onClose={() => { setRequestDelete(null); setRequestReason(''); }}
        onConfirm={handleRequestDelete}
        title="Gửi yêu cầu xóa khách hàng?"
        description={
          <span>
            Yêu cầu xóa <strong>{requestDelete?.fullName}</strong> sẽ được gửi đến quản lý để phê duyệt.
          </span>
        }
        confirmLabel="Gửi yêu cầu"
        cancelLabel="Hủy"
        variant="warning"
        loading={requesting}
      />

      {/* Approve Delete Dialog (for CS/CEO/master_sales) */}
      <ConfirmDialog
        open={!!confirmApprove}
        onClose={() => setConfirmApprove(null)}
        onConfirm={handleApproveDelete}
        title="Phê duyệt xóa khách hàng?"
        description={
          <span>
            Xác nhận xóa vĩnh viễn khách hàng <strong>{confirmApprove?.fullName}</strong>?
            Hành động này không thể hoàn tác.
          </span>
        }
        confirmLabel="Phê duyệt & Xóa"
        cancelLabel="Hủy"
        variant="danger"
        loading={approving}
      />

      {/* Reject Delete Dialog */}
      <ConfirmDialog
        open={!!confirmReject}
        onClose={() => setConfirmReject(null)}
        onConfirm={handleRejectDelete}
        title="Từ chối yêu cầu xóa?"
        description={
          <span>
            Yêu cầu xóa khách hàng <strong>{confirmReject?.fullName}</strong> sẽ bị từ chối.
          </span>
        }
        confirmLabel="Từ chối"
        cancelLabel="Hủy"
        variant="default"
        loading={rejecting}
      />
    </div>
  );
}
