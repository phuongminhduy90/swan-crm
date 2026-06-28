'use client';

import { useState } from 'react';
import { UsersTable } from '@/components/users/users-table';
import { CreateUserDialog } from '@/components/users/create-user-dialog';
import { EditUserDialog } from '@/components/users/edit-user-dialog';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import type { User } from '@/lib/types';

export default function UsersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quản lý người dùng</h2>
          <p className="mt-1 text-sm text-gray-500">
            Quản lý tài khoản và vai trò người dùng trong hệ thống
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} leftIcon={<UserPlus className="h-4 w-4" />}>
          Tạo người dùng
        </Button>
      </div>

      <UsersTable
        key={refreshKey}
        refreshTrigger={refreshKey}
        onEdit={(user) => setEditingUser(user)}
      />

      <CreateUserDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />

      {editingUser && (
        <EditUserDialog
          user={editingUser}
          open={true}
          onClose={() => setEditingUser(null)}
          onUpdated={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}