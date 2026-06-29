'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Search, Plus, Trash2, ChevronRight, ChevronLeft,
  User, PackagePlus, FileText, ExternalLink, CheckSquare, Square, Star,
} from 'lucide-react';
import Link from 'next/link';
import { getAllCustomers, getAllTreatmentLocations, getAllServices, getCustomer } from '@/lib/firestore';
import { Customer, TreatmentLocation, Service, ServiceCategory, CaseRecord } from '@/lib/types';
import { createCaseSchema, type CreateCaseFormValues } from '@/lib/validators/case';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  SERVICE_CATEGORY_LABELS,
  SERVICE_CATEGORY_COLORS,
  ALL_SERVICE_CATEGORIES,
} from '@/constants/service-categories';
import { formatCurrency, formatPhone } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

// ---------- Extended form schema with services ----------
const serviceRowSchema = z.object({
  serviceName: z.string().min(1, 'Nhập tên dịch vụ'),
  serviceCategory: z.enum([
    'nose', 'breast', 'body', 'eyes', 'skin', 'injectable', 'other',
  ] as const),
  listedPrice: z.number().min(0),
  finalPrice: z.number().min(0),
  quantity: z.number().min(1).default(1),
  isMainService: z.boolean().default(false),
  isGift: z.boolean().default(false),
  isUpsell: z.boolean().default(false),
  note: z.string().optional(),
});

export type ServiceRowValues = z.infer<typeof serviceRowSchema>;

export interface CaseFormSubmitData extends CreateCaseFormValues {
  services: ServiceRowValues[];
}

interface CaseFormProps {
  initialData?: Partial<CaseRecord>;
  initialServices?: ServiceRowValues[];
  mode?: 'create' | 'edit';
  onSubmit: (data: CreateCaseFormValues, services: ServiceRowValues[]) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// ---- Step indicator ----
const STEPS = ['Khách hàng', 'Dịch vụ & Bill', 'Chi tiết'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all',
                i < current
                  ? 'border-swan-500 bg-swan-500 text-white'
                  : i === current
                    ? 'border-swan-500 bg-white text-swan-600'
                    : 'border-gray-200 bg-white text-gray-400',
              )}
            >
              {i < current ? '✓' : i + 1}
            </div>
            <span
              className={cn(
                'text-xs font-medium',
                i === current ? 'text-swan-600' : i < current ? 'text-swan-500' : 'text-gray-400',
              )}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={cn(
                'mx-2 mb-5 h-0.5 w-12 transition-all',
                i < current ? 'bg-swan-500' : 'bg-gray-200',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Service Search Row sub-component ----
interface ServiceSearchRowProps {
  index: number;
  services: Service[];
  value: ServiceRowValues;
  onChange: (val: ServiceRowValues) => void;
  onRemove: () => void;
}

function ServiceSearchRow({ index, services, value, onChange, onRemove }: ServiceSearchRowProps) {
  const [nameInput, setNameInput] = useState(value.serviceName ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = services.filter(
    (s) =>
      nameInput.length >= 1 &&
      s.name.toLowerCase().includes(nameInput.toLowerCase()),
  ).slice(0, 8);

  function selectService(s: Service) {
    setNameInput(s.name);
    setShowSuggestions(false);
    onChange({
      ...value,
      serviceName: s.name,
      serviceCategory: s.category,
      listedPrice: s.defaultPrice ?? 0,
      finalPrice: s.defaultPrice ?? 0,
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Dịch vụ #{index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Name + Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Service name autocomplete */}
        <div className="relative">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Tên dịch vụ *</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                setShowSuggestions(true);
                onChange({ ...value, serviceName: e.target.value });
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Nhập tên dịch vụ..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => selectService(s)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-swan-50"
                >
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-xs font-medium',
                      SERVICE_CATEGORY_COLORS[s.category],
                    )}
                  >
                    {SERVICE_CATEGORY_LABELS[s.category]}
                  </span>
                  <span className="truncate text-gray-900">{s.name}</span>
                  {s.defaultPrice && (
                    <span className="ml-auto text-xs text-gray-400 shrink-0">
                      {formatCurrency(s.defaultPrice)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Nhóm</label>
          <select
            value={value.serviceCategory ?? 'other'}
            onChange={(e) => onChange({ ...value, serviceCategory: e.target.value as ServiceCategory })}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
          >
            {ALL_SERVICE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{SERVICE_CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Prices + Quantity */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Giá niêm yết</label>
          <input
            type="number"
            value={value.listedPrice ?? 0}
            onChange={(e) => onChange({ ...value, listedPrice: Number(e.target.value) })}
            min={0}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Giá thực</label>
          <input
            type="number"
            value={value.finalPrice ?? 0}
            onChange={(e) => onChange({ ...value, finalPrice: Number(e.target.value) })}
            min={0}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">SL</label>
          <input
            type="number"
            value={value.quantity ?? 1}
            onChange={(e) => onChange({ ...value, quantity: Number(e.target.value) })}
            min={1}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
          />
        </div>
      </div>

      {/* Checkboxes */}
      <div className="flex flex-wrap gap-4">
        {[
          { key: 'isMainService', label: 'Dịch vụ chính' },
          { key: 'isGift', label: 'Tặng thêm' },
          { key: 'isUpsell', label: 'Upsell' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ ...value, [key]: !value[key as keyof ServiceRowValues] })}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-all',
              value[key as keyof ServiceRowValues]
                ? 'border-swan-400 bg-swan-50 text-swan-700'
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
            )}
          >
            {value[key as keyof ServiceRowValues]
              ? <CheckSquare className="h-3.5 w-3.5" />
              : <Square className="h-3.5 w-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* Subtotal */}
      <div className="flex justify-end pt-1">
        <p className="text-sm text-gray-500">
          Thành tiền:{' '}
          <span className="font-semibold text-gray-900">
            {formatCurrency((value.finalPrice ?? 0) * (value.quantity ?? 1))}
          </span>
        </p>
      </div>
    </div>
  );
}

// ---- Main CaseForm ----
const DEFAULT_SERVICE: ServiceRowValues = {
  serviceName: '',
  serviceCategory: 'other',
  listedPrice: 0,
  finalPrice: 0,
  quantity: 1,
  isMainService: false,
  isGift: false,
  isUpsell: false,
  note: '',
};

export function CaseForm({ initialData, initialServices, mode = 'create', onSubmit, onCancel, loading = false }: CaseFormProps) {
  const isEdit = mode === 'edit';
  const [step, setStep] = useState(isEdit ? 1 : 0); // Skip customer step in edit mode
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<TreatmentLocation[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [serviceRows, setServiceRows] = useState<ServiceRowValues[]>(
    initialServices?.length ? initialServices : [{ ...DEFAULT_SERVICE }],
  );

  // Customer search
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const filteredCustomers = customers.filter((c) => {
    const q = customerQuery.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.customerCode?.toLowerCase().includes(q) ?? false)
    );
  }).slice(0, 10);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateCaseFormValues>({
    resolver: zodResolver(createCaseSchema),
    defaultValues: {
      customerId: initialData?.customerId ?? '',
      mainServiceGroup: initialData?.mainServiceGroup ?? 'nose',
      priority: initialData?.priority ?? 'normal',
      totalBillBeforeDiscount: initialData?.totalBillBeforeDiscount ?? 0,
      discountType: initialData?.discountType ?? 'none',
      discountValue: initialData?.discountValue ?? 0,
      discountReason: initialData?.discountReason ?? '',
      totalBillAfterDiscount: initialData?.totalBillAfterDiscount ?? 0,
      amountPaid: initialData?.amountPaid ?? 0,
      treatmentLocationId: initialData?.treatmentLocationId ?? '',
      treatmentLocationType: initialData?.treatmentLocationType,
      expectedLabDate: initialData?.expectedLabDate ?? '',
      expectedProcedureDate: initialData?.expectedProcedureDate ?? '',
      salesNote: initialData?.salesNote ?? '',
      medicalNote: initialData?.medicalNote ?? '',
      internalNote: initialData?.internalNote ?? '',
      privacyLevel: initialData?.privacyLevel ?? 'normal',
    },
  });

  const watchDiscount = watch('discountType');
  const watchDiscountVal = watch('discountValue');

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const [cs, ls, svcs] = await Promise.all([
          getAllCustomers(),
          getAllTreatmentLocations(),
          getAllServices(),
        ]);
        setCustomers(cs);
        setLocations(ls);
        setServices(svcs);
      } catch (err) {
        console.error('CaseForm load error:', err);
      } finally {
        setDataLoading(false);
      }
    }
    load();
  }, []);

  // In edit mode, pre-select the customer when data loads
  useEffect(() => {
    if (isEdit && initialData?.customerId && customers.length > 0 && !selectedCustomer) {
      const match = customers.find((c) => c.id === initialData.customerId);
      if (match) {
        setSelectedCustomer(match);
        setCustomerQuery(match.fullName);
        setValue('customerId', match.id);
      }
    }
  }, [isEdit, initialData?.customerId, customers, selectedCustomer, setValue]);

  // Recalculate bill totals from service rows
  useEffect(() => {
    const total = serviceRows.reduce((sum, s) => {
      if (s.isGift) return sum;
      return sum + (s.finalPrice ?? 0) * (s.quantity ?? 1);
    }, 0);
    const listed = serviceRows.reduce((sum, s) => {
      if (s.isGift) return sum;
      return sum + (s.listedPrice ?? 0) * (s.quantity ?? 1);
    }, 0);

    setValue('totalBillBeforeDiscount', listed);

    // Apply discount
    let afterDiscount = total;
    if (watchDiscount === 'percent' && watchDiscountVal) {
      afterDiscount = total * (1 - watchDiscountVal / 100);
    } else if (watchDiscount === 'fixed' && watchDiscountVal) {
      afterDiscount = Math.max(0, total - watchDiscountVal);
    }
    setValue('totalBillAfterDiscount', afterDiscount);
  }, [serviceRows, watchDiscount, watchDiscountVal, setValue]);

  // Infer mainServiceGroup from first isMainService row
  useEffect(() => {
    const main = serviceRows.find((s) => s.isMainService);
    if (main?.serviceCategory) {
      setValue('mainServiceGroup', main.serviceCategory);
    } else if (serviceRows[0]?.serviceCategory) {
      setValue('mainServiceGroup', serviceRows[0].serviceCategory);
    }
  }, [serviceRows, setValue]);

  const handleServiceRowChange = useCallback((index: number, val: ServiceRowValues) => {
    setServiceRows((prev) => prev.map((r, i) => (i === index ? val : r)));
  }, []);

  const handleAddService = () => {
    setServiceRows((prev) => [...prev, { ...DEFAULT_SERVICE }]);
  };

  const handleRemoveService = (index: number) => {
    setServiceRows((prev) => prev.filter((_, i) => i !== index));
  };

  const watchBillBefore = watch('totalBillBeforeDiscount');
  const watchBillAfter = watch('totalBillAfterDiscount');
  const watchAmountPaid = watch('amountPaid');

  const formSubmit = handleSubmit(async (data) => {
    await onSubmit(data, serviceRows);
  });

  const canGoNext = () => {
    if (!isEdit && step === 0 && !selectedCustomer) return false;
    if (step === 1 && serviceRows.length === 0) return false;
    return true;
  };

  // Step 0: Customer Selection
  const StepCustomer = (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Chọn khách hàng</h3>
        <p className="text-sm text-gray-500">Tìm kiếm khách hàng đã có hoặc tạo mới</p>
      </div>

      {/* Customer search */}
      <div className="relative">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Tìm khách hàng</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={customerQuery}
            onChange={(e) => {
              setCustomerQuery(e.target.value);
              setShowCustomerDropdown(true);
            }}
            onFocus={() => setShowCustomerDropdown(true)}
            onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
            placeholder="Tìm theo tên, SĐT, mã KH..."
            disabled={dataLoading}
            className="h-11 w-full rounded-xl border border-gray-300 bg-white pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
          />
        </div>

        {showCustomerDropdown && customerQuery.length >= 1 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
            {filteredCustomers.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">Không tìm thấy khách hàng</div>
            ) : (
              filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={() => {
                    setSelectedCustomer(c);
                    setCustomerQuery(c.fullName);
                    setShowCustomerDropdown(false);
                    setValue('customerId', c.id);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-swan-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-swan-100 text-swan-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{c.fullName}</p>
                    <p className="text-xs text-gray-500">{formatPhone(c.phone)}</p>
                  </div>
                  {c.customerCode && (
                    <span className="text-xs text-gray-400 font-mono shrink-0">{c.customerCode}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected customer card */}
      {selectedCustomer && (
        <div className="rounded-xl border border-swan-200 bg-swan-50 p-4 flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-swan-200 text-swan-700">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900">{selectedCustomer.fullName}</p>
            <p className="text-sm text-gray-600">{formatPhone(selectedCustomer.phone)}</p>
            {selectedCustomer.customerCode && (
              <p className="text-xs text-gray-400 font-mono">{selectedCustomer.customerCode}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedCustomer(null);
              setCustomerQuery('');
              setValue('customerId', '');
            }}
            className="text-xs text-gray-400 hover:text-red-500"
          >
            Xóa
          </button>
        </div>
      )}

      {errors.customerId && (
        <p className="text-xs text-red-600">{errors.customerId.message}</p>
      )}

      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">hoặc</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <Link
        href="/customers/new"
        target="_blank"
        className="flex items-center gap-2 text-sm text-swan-600 font-medium hover:text-swan-700"
      >
        <Plus className="h-4 w-4" />
        Tạo khách hàng mới
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );

  // Step 1: Services & Bill
  const totalBillDisplay = serviceRows.reduce((sum, s) => {
    if (s.isGift) return sum;
    return sum + (s.finalPrice ?? 0) * (s.quantity ?? 1);
  }, 0);

  const StepServices = (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Dịch vụ & Bill</h3>
        <p className="text-sm text-gray-500">Thêm các dịch vụ thực hiện cho khách hàng</p>
      </div>

      {/* Service rows */}
      <div className="space-y-3">
        {serviceRows.map((row, i) => (
          <ServiceSearchRow
            key={i}
            index={i}
            services={services}
            value={row}
            onChange={(val) => handleServiceRowChange(i, val)}
            onRemove={() => handleRemoveService(i)}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddService}
        leftIcon={<Plus className="h-4 w-4" />}
      >
        Thêm dịch vụ
      </Button>

      {/* Bill summary */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Tổng hợp Bill</p>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tổng dịch vụ (niêm yết)</span>
            <span className="font-medium">{formatCurrency(watchBillBefore ?? 0)}</span>
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Loại giảm giá</label>
              <select
                {...register('discountType')}
                className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:border-swan-500 focus:outline-none"
              >
                <option value="none">Không giảm</option>
                <option value="percent">Theo %</option>
                <option value="fixed">Số tiền cố định</option>
                <option value="gift">Tặng thêm</option>
              </select>
            </div>
            {watchDiscount && watchDiscount !== 'none' && watchDiscount !== 'gift' && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Giá trị {watchDiscount === 'percent' ? '(%)' : '(VNĐ)'}
                </label>
                <input
                  type="number"
                  {...register('discountValue', { valueAsNumber: true })}
                  min={0}
                  className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm focus:border-swan-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {watchDiscount && watchDiscount !== 'none' && (
            <input
              type="text"
              {...register('discountReason')}
              placeholder="Lý do giảm giá..."
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-swan-500 focus:outline-none"
            />
          )}

          <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-semibold">
            <span>Tổng bill</span>
            <span className="text-gray-900">{formatCurrency(watchBillAfter ?? 0)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <label className="text-gray-600 font-medium">Đặt cọc ngay</label>
            <input
              type="number"
              {...register('amountPaid', { valueAsNumber: true })}
              min={0}
              className="h-8 w-36 rounded-lg border border-gray-300 bg-white px-2 text-right text-sm focus:border-swan-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-between text-sm text-red-600 font-medium">
            <span>Còn lại</span>
            <span>
              {formatCurrency(Math.max(0, (watchBillAfter ?? 0) - (watchAmountPaid ?? 0)))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // Step 2: Details
  const StepDetails = (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Thông tin chi tiết</h3>
        <p className="text-sm text-gray-500">Lịch, địa điểm, ghi chú và mức độ ưu tiên</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Priority */}
        <Select
          label="Mức độ ưu tiên"
          {...register('priority')}
          error={errors.priority?.message}
        >
          <option value="normal">Thường</option>
          <option value="high">Cao</option>
          <option value="urgent">Khẩn cấp</option>
        </Select>

        {/* Privacy level */}
        <Select
          label="Mức độ bảo mật"
          {...register('privacyLevel')}
          error={errors.privacyLevel?.message}
        >
          <option value="normal">Bình thường</option>
          <option value="vip">VIP</option>
          <option value="highly_sensitive">Tuyệt mật</option>
        </Select>

        {/* Treatment location */}
        <div className="sm:col-span-2">
          <Select
            label="Nơi thực hiện"
            {...register('treatmentLocationId')}
            error={errors.treatmentLocationId?.message}
          >
            <option value="">— Chưa chọn —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
        </div>

        {/* Expected lab date */}
        <Input
          label="Ngày xét nghiệm dự kiến"
          type="date"
          {...register('expectedLabDate')}
          error={errors.expectedLabDate?.message}
        />

        {/* Expected procedure date */}
        <Input
          label="Ngày phẫu thuật dự kiến"
          type="date"
          {...register('expectedProcedureDate')}
          error={errors.expectedProcedureDate?.message}
        />
      </div>

      {/* Notes */}
      <div className="space-y-3">
        <Textarea
          label="Ghi chú kinh doanh"
          rows={2}
          placeholder="Ghi chú cho team kinh doanh..."
          {...register('salesNote')}
        />
        <Textarea
          label="Ghi chú y tế"
          rows={2}
          placeholder="Ghi chú y tế (bác sĩ, điều phối...)..."
          {...register('medicalNote')}
        />
        <Textarea
          label="Ghi chú nội bộ"
          rows={2}
          placeholder="Ghi chú nội bộ..."
          {...register('internalNote')}
        />
      </div>
    </div>
  );

  const steps = [StepCustomer, StepServices, StepDetails];

  return (
    <form onSubmit={formSubmit} className="max-w-2xl mx-auto">
      <StepIndicator current={step} />

      <div className="min-h-[400px]">
        {steps[step]}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={step === (isEdit ? 1 : 0) ? onCancel : () => setStep(step - 1)}
          leftIcon={step > (isEdit ? 1 : 0) ? <ChevronLeft className="h-4 w-4" /> : undefined}
        >
          {step === (isEdit ? 1 : 0) ? 'Hủy' : 'Quay lại'}
        </Button>

        <div className="flex items-center gap-3">
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              variant="primary"
              disabled={!canGoNext()}
              onClick={() => setStep(step + 1)}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              Tiếp tục
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              leftIcon={<FileText className="h-4 w-4" />}
            >
              {isEdit ? 'Cập nhật' : 'Tạo hồ sơ CA'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
