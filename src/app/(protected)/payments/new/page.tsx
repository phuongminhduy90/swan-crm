'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, FolderOpen, DollarSign, ArrowLeft } from 'lucide-react';
import { CaseRecord, Customer } from '@/lib/types';
import { getAllCases, getCustomer, createPayment, writeAuditLog } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search-input';
import { PaymentForm } from '@/components/payments/payment-form';
import { formatCurrency } from '@/lib/utils/format';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/config/roles';
import { CreatePaymentFormValues } from '@/lib/validators/payment';

export default function NewPaymentPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [customersMap, setCustomersMap] = useState<Record<string, Customer>>({});
  const [search, setSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = !!user && hasPermission(user.role, 'payments:write');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const allCases = await getAllCases();
        if (cancelled) return;
        setCases(allCases);

        const customerIds = Array.from(new Set(allCases.map((c) => c.customerId)));
        const customers = await Promise.all(customerIds.map((id) => getCustomer(id)));
        if (cancelled) return;
        const map: Record<string, Customer> = {};
        customers.forEach((c) => { if (c) map[c.id] = c; });
        setCustomersMap(map);
      } catch (err) {
        console.error('[NewPayment] Failed to load cases:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const filteredCases = cases.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const cust = customersMap[c.customerId];
    return (
      c.caseCode.toLowerCase().includes(q) ||
      (cust?.fullName.toLowerCase().includes(q) ?? false) ||
      (cust?.phone.includes(q) ?? false)
    );
  }).slice(0, 10);

  async function handleSubmit(data: CreatePaymentFormValues) {
    if (!selectedCase) return;
    setSubmitting(true);
    setError(null);
    try {
      const newPayment = await createPayment(data, user?.id ?? 'dev-user');
      await writeAuditLog({
        actorId: user?.id ?? 'dev-user',
        actorName: user?.displayName ?? 'Dev',
        actorRole: user?.role ?? 'admin',
        action: 'payment_created',
        entityType: 'payment',
        entityId: newPayment.id,
        after: data as unknown as Record<string, unknown>,
      });
      router.push('/payments');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setError('Không thể tạo thanh toán: ' + message);
      setSubmitting(false);
    }
  }

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card className="flex flex-col items-center justify-center py-16 text-gray-400">
          <DollarSign className="mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">Không có quyền tạo thanh toán</p>
          <p className="mt-1 text-sm">Vai trò của bạn không được phép thực hiện thao tác này</p>
          <Link href="/payments" className="mt-4 text-sm text-swan-600 hover:underline">
            Quay lại danh sách
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/payments" className="flex items-center gap-1.5 hover:text-swan-600 transition-colors">
          <FolderOpen className="h-4 w-4" />
          Thanh toán
        </Link>
        <ChevronRight className="h-4 w-4 text-gray-300" />
        <span className="text-gray-900 font-medium">Tạo thanh toán mới</span>
      </nav>

      <div>
        <h1 className="text-xl font-bold text-gray-900">Tạo thanh toán mới</h1>
        <p className="mt-1 text-sm text-gray-500">
          Chọn hồ sơ CASE và nhập thông tin thanh toán
        </p>
      </div>

      {!selectedCase ? (
        <div className="space-y-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo mã CASE, tên khách hàng, SĐT..." />

          {loading ? (
            <Card className="flex items-center justify-center py-12 text-gray-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-swan-200 border-t-swan-500" />
            </Card>
          ) : filteredCases.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 text-gray-400">
              <DollarSign className="mb-2 h-8 w-8 opacity-30" />
              <p>Không tìm thấy hồ sơ</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredCases.map((c) => {
                const cust = customersMap[c.customerId];
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCase(c)}
                    className="block w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-swan-300 hover:bg-swan-50/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <span className="rounded-md bg-swan-50 px-2 py-0.5 text-xs font-mono font-semibold text-swan-700 border border-swan-200">
                          {c.caseCode}
                        </span>
                        <p className="mt-2 font-medium text-gray-900">{cust?.fullName ?? '—'}</p>
                        <p className="text-xs text-gray-500">{cust?.phone ?? '—'}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold text-gray-900">{formatCurrency(c.totalBillAfterDiscount)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Đã thu: {formatCurrency(c.amountPaid)}
                        </p>
                        {c.remainingAmount > 0 && (
                          <p className="text-xs text-red-600 mt-0.5">
                            Còn: {formatCurrency(c.remainingAmount)}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded-md bg-swan-50 px-2 py-0.5 text-xs font-mono font-semibold text-swan-700 border border-swan-200">
                  {selectedCase.caseCode}
                </span>
                <p className="mt-2 font-medium text-gray-900">
                  {customersMap[selectedCase.customerId]?.fullName ?? '—'}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Tổng bill</p>
                    <p className="font-semibold">{formatCurrency(selectedCase.totalBillAfterDiscount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Đã thu</p>
                    <p className="font-semibold text-emerald-600">{formatCurrency(selectedCase.amountPaid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Còn lại</p>
                    <p className="font-semibold text-red-600">{formatCurrency(selectedCase.remainingAmount)}</p>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />} onClick={() => { setSelectedCase(null); setError(null); }}>
                Đổi CASE
              </Button>
            </div>
          </Card>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <Card>
            <PaymentForm
              caseId={selectedCase.id}
              customerId={selectedCase.customerId}
              onSubmit={handleSubmit}
              onClose={() => router.push('/payments')}
            />
          </Card>
        </div>
      )}
    </div>
  );
}