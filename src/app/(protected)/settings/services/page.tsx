'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Service } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ServiceListTable, ServiceForm } from '@/components/services';
import { CreateServiceFormValues } from '@/lib/validators/service';
import { createService, updateService } from '@/lib/firestore';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/config/roles';

export default function ServicesPage() {
  const { user } = useCurrentUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canWrite = !!user && hasPermission(user.role, 'settings:write');

  function refresh() { setRefreshKey((k) => k + 1); }

  async function handleCreate(data: CreateServiceFormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createService(data);
      setCreateOpen(false);
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setSubmitError('Không thể tạo dịch vụ: ' + message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(data: CreateServiceFormValues) {
    if (!editing) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await updateService(editing.id, data);
      setEditing(null);
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setSubmitError('Không thể cập nhật dịch vụ: ' + message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dịch vụ</h1>
          <p className="mt-1 text-sm text-gray-500">
            Danh mục dịch vụ phẫu thuật thẩm mỹ
          </p>
        </div>
        {canWrite && (
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Thêm dịch vụ
          </Button>
        )}
      </div>

      <ServiceListTable refresh={refreshKey} onEdit={setEditing} />

      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setSubmitError(null); }}
        title="Thêm dịch vụ mới"
        description="Tạo dịch vụ trong danh mục"
        size="lg"
      >
        <div className="p-6">
          <ServiceForm
            onSubmit={handleCreate}
            onCancel={() => { setCreateOpen(false); setSubmitError(null); }}
            loading={submitting}
            error={submitError}
          />
        </div>
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setSubmitError(null); }}
        title="Chỉnh sửa dịch vụ"
        description={editing?.name}
        size="lg"
      >
        {editing && (
          <div className="p-6">
            <ServiceForm
              service={editing}
              onSubmit={handleEdit}
              onCancel={() => { setEditing(null); setSubmitError(null); }}
              loading={submitting}
              error={submitError}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}