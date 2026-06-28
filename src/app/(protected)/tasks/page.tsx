'use client';

import { useState, useCallback } from 'react';
import { Plus, ClipboardList } from 'lucide-react';
import { Task } from '@/lib/types';
import { createTask, getAllTasks } from '@/lib/firestore';
import { useAuth } from '@/lib/auth/AuthProvider';
import { TaskList } from '@/components/tasks/task-list';
import { TaskForm } from '@/components/tasks/task-form';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';

export default function TasksPage() {
  const { userProfile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const handleRefresh = useCallback(() => {
    setRefresh((r) => r + 1);
    // Re-fetch pending count
    getAllTasks()
      .then((tasks) => {
        const pending = tasks.filter(
          (t: Task) => t.status === 'todo' || t.status === 'in_progress',
        ).length;
        setPendingCount(pending);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (data: {
    title: string;
    description?: string;
    caseId?: string;
    assignedTo?: string;
    dueDate?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
  }) => {
    if (!userProfile) return;
    await createTask(
      {
        title: data.title,
        description: data.description,
        caseId: data.caseId || undefined,
        assignedTo: data.assignedTo || undefined,
        dueDate: data.dueDate || undefined,
        priority: data.priority,
      },
      userProfile.id,
    );
    setShowForm(false);
    handleRefresh();
  };

  const canCreate =
    userProfile?.role === 'admin' ||
    userProfile?.role === 'coordinator' ||
    userProfile?.role === 'master_sales' ||
    userProfile?.role === 'ceo';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-swan-100">
            <ClipboardList className="h-5 w-5 text-swan-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Công việc</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {pendingCount !== null
                ? `${pendingCount} công việc đang chờ xử lý`
                : 'Quản lý và theo dõi công việc của đội ngũ'}
            </p>
          </div>
        </div>
        {canCreate && (
          <Button
            onClick={() => setShowForm(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Tạo công việc
          </Button>
        )}
      </div>

      {/* Task List */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <TaskList refresh={refresh} onRefresh={handleRefresh} />
      </div>

      {/* Create Task Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Tạo công việc mới"
        description="Điền thông tin để tạo công việc và giao cho thành viên"
        size="md"
      >
        <TaskForm
          onSubmit={handleSubmit}
          onClose={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}