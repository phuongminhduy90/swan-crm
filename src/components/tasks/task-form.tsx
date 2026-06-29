'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User } from '@/lib/types';
import { getAllUsers } from '@/lib/firestore';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  createTaskSchema,
  type CreateTaskFormValues,
  TASK_PRIORITY_LABELS,
} from '@/lib/validators/task';

interface Props {
  onSubmit: (data: CreateTaskFormValues) => Promise<void>;
  onClose: () => void;
}

export function TaskForm({ onSubmit, onClose }: Props) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    getAllUsers()
      .then((data) => setUsers(data.filter((u) => u.isActive)))
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      priority: 'normal',
    },
  });

  const doSubmit = handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <form onSubmit={doSubmit} className="space-y-4 p-6">
      {/* Title */}
      <Input
        label="Tiêu đề công việc *"
        placeholder="Nhập tiêu đề..."
        error={errors.title?.message}
        {...register('title')}
      />

      {/* Description */}
      <Textarea
        label="Mô tả"
        placeholder="Mô tả chi tiết công việc..."
        {...register('description')}
      />

      {/* Case ID (optional) */}
      <Input
        label="Mã CA (tùy chọn)"
        placeholder="Ví dụ: CA-001"
        hint="Liên kết với một hồ sơ ca (nếu có)"
        error={errors.caseId?.message}
        {...register('caseId')}
      />

      <div className="grid grid-cols-2 gap-4">
        {/* Assigned To */}
        <Select
          label="Giao cho"
          error={errors.assignedTo?.message}
          {...register('assignedTo')}
        >
          <option value="">— Chưa giao —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </Select>

        {/* Priority */}
        <Select
          label="Mức ưu tiên *"
          error={errors.priority?.message}
          {...register('priority')}
        >
          {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>

      {/* Due Date */}
      <Input
        label="Hạn hoàn thành"
        type="date"
        error={errors.dueDate?.message}
        {...register('dueDate')}
      />

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Hủy
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Tạo công việc
        </Button>
      </div>
    </form>
  );
}
