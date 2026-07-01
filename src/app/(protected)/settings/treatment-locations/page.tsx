'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { TreatmentLocation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { LocationListTable, LocationForm } from '@/components/locations';
import {
  createTreatmentLocation,
  updateTreatmentLocation,
} from '@/lib/firestore';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/config/roles';
import type { CreateTreatmentLocationFormValues } from '@/lib/validators/treatment-location';

export default function TreatmentLocationsPage() {
  const { user } = useCurrentUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TreatmentLocation | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canWrite = !!user && hasPermission(user.role, 'settings:write');

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  async function handleCreate(data: CreateTreatmentLocationFormValues) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createTreatmentLocation(data);
      setCreateOpen(false);
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setSubmitError('Không thể tạo địa điểm: ' + message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(data: CreateTreatmentLocationFormValues) {
    if (!editing) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await updateTreatmentLocation(editing.id, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
      setEditing(null);
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setSubmitError('Không thể cập nhật địa điểm: ' + message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Điểm điều trị</h1>
          <p className="mt-1 text-sm text-gray-500">
            Quản lý các bệnh viện và phòng khám liên kết
          </p>
        </div>
        {canWrite && (
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
            Thêm địa điểm
          </Button>
        )}
      </div>

      <LocationListTable refresh={refreshKey} onEdit={setEditing} />

      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setSubmitError(null); }}
        title="Thêm địa điểm mới"
        description="Tạo địa điểm điều trị hoặc bệnh viện liên kết"
        size="lg"
        closeLabel="Đóng hộp thoại thêm địa điểm"
      >
        <div className="p-6">
          <LocationForm
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
        title="Chỉnh sửa địa điểm"
        description={editing?.name}
        size="lg"
        closeLabel="Đóng hộp thoại chỉnh sửa địa điểm"
      >
        {editing && (
          <div className="p-6">
            <LocationForm
              location={editing}
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
