'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, RefreshCw, ClipboardList } from 'lucide-react';
import { Task } from '@/lib/types';
import { getAllTasks, updateTaskStatus } from '@/lib/firestore';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateVN } from '@/lib/utils/format';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

type PriorityFilter = 'all' | Task['priority'];
type StatusFilter = 'all' | Task['status'];

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  low: 'Thấp',
  normal: 'Thường',
  high: 'Cao',
  urgent: 'Khẩn',
};

const STATUS_LABELS: Record<Task['status'], string> = {
  todo: 'Cần làm',
  in_progress: 'Đang làm',
  done: 'Hoàn thành',
  overdue: 'Quá hạn',
  cancelled: 'Đã hủy',
};

const priorityBadge = (priority: Task['priority']) => {
  const map: Record<Task['priority'], string> = {
    low: 'bg-gray-100 text-gray-600',
    normal: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-700',
    urgent: 'bg-red-100 text-red-700',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        map[priority],
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
};

const statusBadge = (status: Task['status']) => {
  const map: Record<Task['status'], string> = {
    todo: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-700',
    done: 'bg-emerald-100 text-emerald-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        map[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
};

interface Props {
  refresh?: number;
  onRefresh?: () => void;
}

export function TaskList({ refresh, onRefresh }: Props) {
  const { userProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [marking, setMarking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllTasks();
      setTasks(data);
    } catch {
      setError('Không thể tải danh sách công việc');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refresh]);

  const handleMarkDone = async (task: Task) => {
    if (!userProfile) return;
    setMarking(task.id);
    try {
      await updateTaskStatus(task.id, 'done', userProfile.id);
      await load();
      onRefresh?.();
    } catch (err) {
      console.error('[TaskList] Mark done error:', err);
    } finally {
      setMarking(null);
    }
  };

  const filtered = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const isDueSoon = (dueDate?: string) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const now = new Date();
    const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 2;
  };

  const isAssignedToMe = (task: Task) => userProfile && task.assignedTo === userProfile.id;

  const columns = [
    {
      key: 'title',
      header: 'Tiêu đề',
      render: (row: Task) => (
        <div>
          <p className="text-sm font-medium text-gray-900 line-clamp-1">{row.title}</p>
          {row.description && (
            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'caseId',
      header: 'Mã CA',
      render: (row: Task) =>
        row.caseId ? (
          <a
            href={`/cases/${row.caseId}`}
            className="text-xs font-mono text-swan-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.caseId}
          </a>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      key: 'assignedTo',
      header: 'Được giao',
      render: (row: Task) => (
        <span className="text-sm text-gray-600">
          {row.assignedTo ? (
            isAssignedToMe(row) ? (
              <span className="font-medium text-swan-700">Tôi</span>
            ) : (
              row.assignedTo
            )
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Hạn',
      render: (row: Task) => (
        <span
          className={cn(
            'text-sm',
            isDueSoon(row.dueDate) && row.status !== 'done'
              ? 'font-semibold text-amber-600'
              : 'text-gray-600',
            row.status === 'overdue' && 'text-red-600 font-semibold',
          )}
        >
          {formatDateVN(row.dueDate)}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Ưu tiên',
      render: (row: Task) => priorityBadge(row.priority),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row: Task) => statusBadge(row.status),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (row: Task) =>
        isAssignedToMe(row) && (row.status === 'todo' || row.status === 'in_progress') ? (
          <Button
            size="sm"
            variant="outline"
            isLoading={marking === row.id}
            onClick={(e) => {
              e.stopPropagation();
              handleMarkDone(row);
            }}
            leftIcon={<CheckCircle className="h-3 w-3" />}
          >
            Hoàn thành
          </Button>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
  ];

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
        <Button size="sm" variant="ghost" onClick={load} className="ml-auto">
          <RefreshCw className="h-3 w-3" /> Thử lại
        </Button>
      </div>
    );
  }

  if (!loading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <ClipboardList className="mb-3 h-10 w-10 opacity-30" />
        <p className="font-medium">Chưa có task nào</p>
        <p className="mt-1 text-sm">Tạo task mới để bắt đầu</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Trạng thái:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-swan-500 focus:outline-none focus:ring-1 focus:ring-swan-500/30"
          >
            <option value="all">Tất cả</option>
            {(Object.keys(STATUS_LABELS) as Task['status'][]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Ưu tiên:</label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-swan-500 focus:outline-none focus:ring-1 focus:ring-swan-500/30"
          >
            <option value="all">Tất cả</option>
            {(Object.keys(PRIORITY_LABELS) as Task['priority'][]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-xs text-gray-500 self-center">
          {filtered.length} / {tasks.length} công việc
        </div>
      </div>

      <DataTable<Record<string, unknown>>
        columns={columns as never}
        data={filtered as unknown as Record<string, unknown>[]}
        loading={loading}
        emptyMessage="Không có công việc nào"
      />
    </div>
  );
}
