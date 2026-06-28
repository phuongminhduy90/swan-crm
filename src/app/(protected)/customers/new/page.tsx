'use client';

import { useRouter } from 'next/navigation';
import { CustomerForm } from '@/components/customers';
import { createCustomer, writeAuditLog } from '@/lib/firestore';
import { CreateCustomerFormValues } from '@/lib/validators/customer';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useState } from 'react';

export default function NewCustomerPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(data: CreateCustomerFormValues) {
    if (!user) return;
    setSubmitError(null);

    try {
      const newCustomer = await createCustomer(data, user.id);
      await writeAuditLog({
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        action: 'customer_created',
        entityType: 'customer',
        entityId: newCustomer.id,
        after: newCustomer as unknown as Record<string, unknown>,
      });
      router.push(`/customers/${newCustomer.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo khách hàng';
      setSubmitError(msg);
    }
  }

  function handleCancel() {
    router.push('/customers');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Thêm khách hàng mới</h1>
        <p className="mt-1 text-sm text-gray-500">
          Điền thông tin để tạo hồ sơ khách hàng
        </p>
      </div>

      {submitError && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 backdrop-blur-sm px-4 py-3 text-sm text-red-700 animate-slide-down">
          {submitError}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100/80 bg-white p-6 shadow-soft">
        <CustomerForm onSubmit={handleSubmit} onCancel={handleCancel} />
      </div>
    </div>
  );
}
