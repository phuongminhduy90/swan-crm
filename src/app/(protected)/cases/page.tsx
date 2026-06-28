'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FolderOpen } from 'lucide-react';
import { CaseList } from '@/components/cases/case-list';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { ROLE_PERMISSIONS } from '@/config/roles';

export default function CasesPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [totalCases, setTotalCases] = useState(0);

  const canCreate =
    user &&
    ROLE_PERMISSIONS[user.role]?.includes('cases:write');

  const handleTotalChange = useCallback((total: number) => {
    setTotalCases(total);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-swan-100 text-swan-600">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hồ sơ CASE</h1>
            <p className="text-sm text-gray-500">
              {totalCases > 0 ? `${totalCases} hồ sơ` : 'Quản lý hồ sơ phẫu thuật'}
            </p>
          </div>
        </div>

        {canCreate && (
          <Button
            variant="primary"
            size="md"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => router.push('/cases/new')}
          >
            Tạo ca mới
          </Button>
        )}
      </div>

      {/* Case List */}
      <CaseList onTotalChange={handleTotalChange} />
    </div>
  );
}