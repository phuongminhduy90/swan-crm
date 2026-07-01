'use client';

import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { Customer } from '@/lib/types';
import { CustomerList } from '@/components/customers';
import { CustomerForm } from '@/components/customers';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/config/roles';
import { createCustomer, writeAuditLog } from '@/lib/firestore';
import { CreateCustomerFormValues } from '@/lib/validators/customer';
import { useToast } from '@/components/ui/toast';

export default function CustomersPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const canWrite = !!user && hasPermission(user.role, 'customers:write');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  async function handleCreate(data: CreateCustomerFormValues) {
    if (!user) return;
    setSubmitting(true);
    try {
      await createCustomer(data, user.id);
      await writeAuditLog({
        actorId: user.id, actorName: user.displayName, actorRole: user.role,
        action: 'customer_created', entityType: 'customer', entityId: 'pending',
        after: data as unknown as Record<string, unknown>,
      });
      toast(`Đã tạo khách hàng ${data.fullName}`, 'success');
      setCreateOpen(false);
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      toast('Không thể tạo khách hàng: ' + msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(data: CreateCustomerFormValues) {
    if (!editing || !user) return;
    setSubmitting(true);
    try {
      const { updateCustomer } = await import('@/lib/firestore');
      await updateCustomer(editing.id, data, user.id);
      await writeAuditLog({
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        action: 'customer_updated',
        entityType: 'customer',
        entityId: editing.id,
        before: editing as unknown as Record<string, unknown>,
        after: data as unknown as Record<string, unknown>,
      });
      toast(`Đã cập nhật ${data.fullName}`, 'success');
      setEditing(null);
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      toast('Không thể cập nhật: ' + msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-swan-500 to-swan-600 shadow-md shadow-swan-500/20">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Khách hàng</h1>
            <p className="mt-0.5 text-sm text-gray-500">Quản lý hồ sơ khách hàng</p>
          </div>
        </div>

        {canWrite && (
          <Button
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setCreateOpen(true)}
          >
            Thêm khách hàng
          </Button>
        )}
      </div>

      {/* Customer list */}
      <CustomerList refresh={refreshKey} onEdit={setEditing} />

      {/* Create Dialog */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Thêm khách hàng mới"
        description="Tạo hồ sơ khách hàng trong hệ thống"
        size="xl"
        closeLabel="Đóng hộp thoại thêm khách hàng"
      >
        <div className="p-6">
          <CustomerForm
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
            loading={submitting}
          />
        </div>
      </Modal>

      {/* Edit Dialog */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Chỉnh sửa khách hàng"
        description={editing?.fullName}
        size="xl"
        closeLabel="Đóng hộp thoại chỉnh sửa khách hàng"
      >
        {editing && (
          <div className="p-6">
            <CustomerForm
              initialData={editing}
              onSubmit={handleEdit}
              onCancel={() => setEditing(null)}
              loading={submitting}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
