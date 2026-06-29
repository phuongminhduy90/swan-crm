'use client';

import { useState, useEffect, useCallback } from 'react';
import { User } from '@/lib/types';
import { ROLE_LABELS, ROLE_COLORS } from '@/config/roles';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils/cn';
import { Pencil, UserCheck, UserX } from 'lucide-react';

interface UsersTableProps {
  onEdit?: (user: User) => void;
  refreshTrigger?: number;
}

export function UsersTable({ onEdit, refreshTrigger = 0 }: UsersTableProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshTrigger]);

  const handleToggleActive = useCallback(
    async (user: User) => {
      try {
        const res = await fetch(`/api/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !user.isActive }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('Toggle active error:', err);
          return;
        }
        fetchUsers();
      } catch (err) {
        console.error('Toggle active error:', err);
      }
    },
    [fetchUsers],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Người dùng
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Vai trò
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
              Trạng thái
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
              Hành động
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="transition-colors hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4">
                <div className="flex items-center gap-3">
                  <Avatar name={user.displayName} size="md" />
                  <span className="font-medium text-gray-900">{user.displayName}</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                {user.email}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    ROLE_COLORS[user.role],
                  )}
                >
                  {ROLE_LABELS[user.role]}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <Badge variant={user.isActive ? 'success' : 'danger'}>
                  {user.isActive ? 'Hoạt động' : 'Ngừng hoạt động'}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit?.(user)}
                    title="Chỉnh sửa"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(user)}
                    title={user.isActive ? 'Ngừng hoạt động' : 'Kích hoạt'}
                  >
                    {user.isActive ? (
                      <UserX className="h-4 w-4 text-red-500" />
                    ) : (
                      <UserCheck className="h-4 w-4 text-emerald-500" />
                    )}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500">
          Chưa có người dùng nào.
        </div>
      )}
    </div>
  );
}