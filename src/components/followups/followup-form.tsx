'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Followup, UpdateFollowupInput, FollowupStatus, SeverityLevel } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';
import { X } from 'lucide-react';

const schema = z.object({
  status: z.enum(['pending', 'contacted', 'no_response', 'issue_reported', 'completed']),
  customerCondition: z.string().optional(),
  note: z.string().optional(),
  nextAction: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface FollowupFormProps {
  followup: Followup;
  onSubmit: (data: UpdateFollowupInput) => Promise<void>;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: FollowupStatus; label: string }[] = [
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'contacted', label: 'Đã liên hệ' },
  { value: 'no_response', label: 'Không liên hệ được' },
  { value: 'issue_reported', label: 'Có vấn đề' },
  { value: 'completed', label: 'Hoàn tất' },
];

function SeveritySlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const colors = [
    'bg-gray-300',
    'bg-green-400',
    'bg-lime-400',
    'bg-yellow-400',
    'bg-orange-400',
    'bg-red-500',
  ];
  const levelLabels = ['Không có', 'Rất nhẹ', 'Nhẹ', 'Vừa', 'Nặng', 'Rất nặng'];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-xs text-gray-500">
          {value} - {levelLabels[value]}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3, 4, 5].map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all border-2',
              value === level
                ? `${colors[level]} text-white border-transparent shadow-md scale-110`
                : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200',
            )}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FollowupForm({ followup, onSubmit, onClose }: FollowupFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [painLevel, setPainLevel] = useState<number>(followup.painLevel ?? 0);
  const [swellingLevel, setSwellingLevel] = useState<number>(followup.swellingLevel ?? 0);
  const [bruisingLevel, setBruisingLevel] = useState<number>(followup.bruisingLevel ?? 0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: followup.status,
      customerCondition: followup.customerCondition ?? '',
      note: followup.note ?? '',
      nextAction: followup.nextAction ?? '',
    },
  });

  const onFormSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        status: values.status as FollowupStatus,
        customerCondition: values.customerCondition,
        painLevel: painLevel as SeverityLevel,
        swellingLevel: swellingLevel as SeverityLevel,
        bruisingLevel: bruisingLevel as SeverityLevel,
        note: values.note,
        nextAction: values.nextAction,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-swan-200 bg-swan-50/30 p-4 shadow-inner">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-swan-700">
          Cập nhật theo dõi {followup.followupDay}
        </h4>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <Select
          label="Trạng thái *"
          error={errors.status?.message}
          {...register('status')}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Tình trạng khách hàng
          </label>
          <textarea
            rows={3}
            placeholder="Mô tả tình trạng hiện tại của khách hàng..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
            {...register('customerCondition')}
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Mức độ triệu chứng (0–5)
          </p>
          <SeveritySlider label="Đau" value={painLevel} onChange={setPainLevel} />
          <SeveritySlider label="Sưng" value={swellingLevel} onChange={setSwellingLevel} />
          <SeveritySlider label="Bầm tím" value={bruisingLevel} onChange={setBruisingLevel} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Ghi chú</label>
          <textarea
            rows={2}
            placeholder="Ghi chú thêm..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
            {...register('note')}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Hành động tiếp theo
          </label>
          <textarea
            rows={2}
            placeholder="Kế hoạch xử lý tiếp theo..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-swan-500 focus:outline-none focus:ring-2 focus:ring-swan-500/20"
            {...register('nextAction')}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <Button type="submit" size="sm" isLoading={isSubmitting}>
            Lưu cập nhật
          </Button>
        </div>
      </form>
    </div>
  );
}
