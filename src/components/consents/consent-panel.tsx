'use client';

import { useCallback, useEffect, useState } from 'react';
import { Consent, ConsentStatus, ConsentType } from '@/lib/types';
import { getConsentsByCustomer, getConsentsByCase, createConsent, updateConsentStatus } from '@/lib/firestore/consents';
import { CONSENT_TYPE_LABELS } from '@/lib/validators/consent';
import { writeAuditLog } from '@/lib/firestore/audit';
import { useToast } from '@/components/ui/toast';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import {
  Shield, ShieldCheck, ShieldOff, ShieldX, Loader2,
  Plus, FileSignature, Check, X, AlertTriangle,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface ConsentPanelProps {
  customerId: string;
  caseId?: string;
  canWrite: boolean;
  refreshKey?: number;
}

const STATUS_CONFIG: Record<ConsentStatus, {
  label: string;
  className: string;
  icon: React.ElementType;
}> = {
  pending: {
    label: 'Chờ ký',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: FileSignature,
  },
  granted: {
    label: 'Đã cấp',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: ShieldCheck,
  },
  denied: {
    label: 'Từ chối',
    className: 'bg-red-100 text-red-700 border-red-200',
    icon: ShieldX,
  },
  revoked: {
    label: 'Đã thu hồi',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: ShieldOff,
  },
};

const createSchema = z.object({
  consentType: z.enum(['treatment', 'image_storage', 'marketing_usage', 'hospital_sharing']),
  note: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

export function ConsentPanel({
  customerId,
  caseId,
  canWrite,
  refreshKey = 0,
}: ConsentPanelProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { consentType: 'treatment', note: '' },
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = caseId
        ? await getConsentsByCase(caseId)
        : await getConsentsByCustomer(customerId);
      const sorted = [...data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setConsents(sorted);
    } catch (err) {
      console.error('Load consents error:', err);
      toast('Không thể tải consent', 'error');
    } finally {
      setLoading(false);
    }
  }, [customerId, caseId, toast]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function onCreateSubmit(values: CreateValues) {
    try {
      setSubmitting(true);
      const res = await fetch('/api/consents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          caseId: caseId || undefined,
          consentType: values.consentType,
          note: values.note,
          createdBy: user?.id ?? 'dev-user',
          createdByName: user?.displayName ?? 'Dev User',
          createdByRole: user?.role ?? 'admin',
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error ?? 'Tạo thất bại');
      }

      await writeAuditLog({
        actorId: user?.id ?? 'dev-user',
        actorName: user?.displayName ?? 'Dev User',
        actorRole: user?.role ?? 'admin',
        action: 'consent_created',
        entityType: 'consent',
        entityId: result.result.id,
        after: { consentType: values.consentType, consentStatus: 'pending' },
      });

      toast('Đã tạo consent mới', 'success');
      reset();
      setCreateOpen(false);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast('Không thể tạo: ' + msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(consent: Consent, newStatus: ConsentStatus) {
    try {
      setUpdatingId(consent.id);
      await updateConsentStatus(consent.id, newStatus, user?.id);
      await writeAuditLog({
        actorId: user?.id ?? 'dev-user',
        actorName: user?.displayName ?? 'Dev User',
        actorRole: user?.role ?? 'admin',
        action: 'consent_updated',
        entityType: 'consent',
        entityId: consent.id,
        before: { consentStatus: consent.consentStatus },
        after: { consentStatus: newStatus },
      });
      toast('Đã cập nhật trạng thái consent', 'success');
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast('Không thể cập nhật: ' + msg, 'error');
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {canWrite && (
          <div className="flex justify-end">
            <Button
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setCreateOpen(true)}
            >
              Tạo consent
            </Button>
          </div>
        )}

        {consents.length === 0 ? (
          <Card className="p-8 text-center">
            <Shield className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-500">
              Chưa có consent nào
            </p>
            {canWrite && (
              <p className="mt-1 text-xs text-gray-400">
                Bấm nút Tạo consent để thêm mới
              </p>
            )}
          </Card>
        ) : (
          consents.map((consent) => {
            const config = STATUS_CONFIG[consent.consentStatus];
            const Icon = config.icon;
            return (
              <Card
                key={consent.id}
                className="flex items-start gap-4 p-4 transition-all hover:shadow-medium"
              >
                <div
                  className={cn(
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                    consent.consentStatus === 'granted' && 'bg-emerald-50',
                    consent.consentStatus === 'denied' && 'bg-red-50',
                    consent.consentStatus === 'revoked' && 'bg-amber-50',
                    consent.consentStatus === 'pending' && 'bg-gray-100',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      consent.consentStatus === 'granted' && 'text-emerald-600',
                      consent.consentStatus === 'denied' && 'text-red-600',
                      consent.consentStatus === 'revoked' && 'text-amber-600',
                      consent.consentStatus === 'pending' && 'text-gray-500',
                    )}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {CONSENT_TYPE_LABELS[consent.consentType as ConsentType]}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                        config.className,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </span>
                  </div>
                  {consent.note && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-gray-500">
                      {consent.note}
                    </p>
                  )}
                  {consent.signedAt && (
                    <p className="mt-1.5 text-xs text-gray-400">
                      Ký ngày: {new Date(consent.signedAt).toLocaleDateString('vi-VN')}
                    </p>
                  )}

                  {canWrite && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {consent.consentStatus === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<Check className="h-3 w-3" />}
                            onClick={() => handleStatusChange(consent, 'granted')}
                            disabled={updatingId === consent.id}
                          >
                            Cấp consent
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            leftIcon={<X className="h-3 w-3" />}
                            onClick={() => handleStatusChange(consent, 'denied')}
                            disabled={updatingId === consent.id}
                          >
                            Từ chối
                          </Button>
                        </>
                      )}
                      {consent.consentStatus === 'granted' && (
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<AlertTriangle className="h-3 w-3" />}
                          onClick={() => handleStatusChange(consent, 'revoked')}
                          disabled={updatingId === consent.id}
                        >
                          Thu hồi
                        </Button>
                      )}
                      {consent.consentStatus === 'denied' && (
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<Check className="h-3 w-3" />}
                          onClick={() => handleStatusChange(consent, 'granted')}
                          disabled={updatingId === consent.id}
                        >
                          Cấp lại
                        </Button>
                      )}
                      {consent.consentStatus === 'revoked' && (
                        <Button
                          size="sm"
                          variant="outline"
                          leftIcon={<Check className="h-3 w-3" />}
                          onClick={() => handleStatusChange(consent, 'granted')}
                          disabled={updatingId === consent.id}
                        >
                          Cấp lại
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo consent mới"
        size="md"
        closeLabel="Đóng hộp thoại tạo consent"
      >
        <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4">
          <Select
            label="Loại consent"
            required
            error={errors.consentType?.message}
            {...register('consentType')}
          >
            {Object.entries(CONSENT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>

          <Textarea
            label="Ghi chú (tuỳ chọn)"
            rows={3}
            error={errors.note?.message}
            {...register('note')}
          />

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              Hủy
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Đang tạo...' : 'Tạo consent'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}