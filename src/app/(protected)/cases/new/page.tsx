'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { CaseForm, type ServiceRowValues } from '@/components/cases/case-form';
import { createCase, addCaseService, writeAuditLog } from '@/lib/firestore';
import { type CreateCaseFormValues } from '@/lib/validators/case';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function NewCasePage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(data: CreateCaseFormValues, services: ServiceRowValues[]) {
    if (!user) return;

    try {
      setSubmitting(true);
      setError(null);

      // 1. Create the case
      const newCase = await createCase(data, user.id);

      // 2. Add each service
      await Promise.all(
        services
          .filter((s) => s.serviceName.trim() !== '')
          .map((s) =>
            addCaseService({
              caseId: newCase.id,
              serviceName: s.serviceName,
              serviceCategory: s.serviceCategory,
              listedPrice: s.listedPrice,
              finalPrice: s.finalPrice,
              quantity: s.quantity,
              isMainService: s.isMainService,
              isGift: s.isGift,
              isUpsell: s.isUpsell,
              note: s.note,
            }),
          ),
      );

      // 3. Write audit log
      await writeAuditLog({
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        action: 'case_created',
        entityType: 'case',
        entityId: newCase.id,
        after: { caseCode: newCase.caseCode, status: newCase.status },
      });

      // 4. Navigate to the new case detail page
      router.push(`/cases/${newCase.id}`);
    } catch (err) {
      console.error('Create case error:', err);
      setError('Có lỗi khi tạo hồ sơ. Vui lòng thử lại.');
      setSubmitting(false);
    }
  }

  function handleCancel() {
    router.push('/cases');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link
          href="/cases"
          className="flex items-center gap-1.5 hover:text-swan-600 transition-colors"
        >
          <FolderOpen className="h-4 w-4" />
          Hồ sơ CASE
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-300" />
        <span className="text-gray-900 font-medium">Tạo ca mới</span>
      </nav>

      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Tạo hồ sơ CA mới</h1>
        <p className="text-sm text-gray-500 mt-1">
          Điền đầy đủ thông tin để khởi tạo hồ sơ phẫu thuật
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <CaseForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={submitting}
        />
      </div>
    </div>
  );
}
