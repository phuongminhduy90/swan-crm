import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Vui lòng nhập tiêu đề công việc'),
  description: z.string().optional(),
  caseId: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
});

export type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: 'Thấp',
  normal: 'Thường',
  high: 'Cao',
  urgent: 'Khẩn',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'Chờ xử lý',
  in_progress: 'Đang thực hiện',
  done: 'Hoàn thành',
  overdue: 'Quá hạn',
  cancelled: 'Đã hủy',
};

export const TASK_PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};
