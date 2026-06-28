'use client';

import { useState, useEffect, useCallback } from 'react';
import { Followup, UpdateFollowupInput, FollowupStatus } from '@/lib/types';
import { getFollowupsByCase, updateFollowup } from '@/lib/firestore/followups';
import { formatDateVN } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FollowupForm } from './followup-form';
import { AlertTriangle, CheckCircle2, Clock, Loader2, PhoneCall, PhoneOff } from 'lucide-react';

interface FollowupListProps {
  caseId: string;
}

const FOLLOWUP_STATUS_CONFIG: Record<
  FollowupStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  pending: {
    label: 'Chờ xử lý',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: Clock,
  },
  contacted: {
    label: 'Đã liên hệ',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: PhoneCall,
  },
  no_response: {
    label: 'Không liên hệ được',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: PhoneOff,
  },
  issue_reported: {
    label: 'Có vấn đề',
    className: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertTriangle,
  },
  completed: {
    label: 'Hoàn tất',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
};

const FOLLOWUP_DAY_ORDER = ['D1', 'D3', 'D7', 'D14', 'D30', 'D90'];

function SeverityDots({ value, color }: { value?: number; color: string }) {
  const filled = value ?? 0;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            'h-2 w-2 rounded-full',
            i <= filled ? color : 'bg-gray-200',
          )}
        />
      ))}
    </div>
  );
}

export function FollowupList({ caseId }: FollowupListProps) {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFollowupsByCase(caseId);
      // Sort by followup day order
      const sorted = [...data].sort(
        (a, b) => FOLLOWUP_DAY_ORDER.indexOf(a.followupDay) - FOLLOWUP_DAY_ORDER.indexOf(b.followupDay),
      );
      setFollowups(sorted);
    } catch {
      setError('Không thể tải danh sách theo dõi');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdate = async (followup: Followup, data: UpdateFollowupInput) => {
    await updateFollowup(followup.id, data);
    setExpandedId(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-swan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (followups.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-400">Chưa có lịch theo dõi hậu phẫu</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[18px] top-6 bottom-6 w-0.5 bg-gray-200" />

      <div className="space-y-4">
        {followups.map((followup) => {
          const dueDate = new Date(followup.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          const isOverdue =
            followup.status === 'pending' && dueDate < today;
          const isExpanded = expandedId === followup.id;
          const canUpdate = followup.status !== 'completed';
          const statusConfig = FOLLOWUP_STATUS_CONFIG[followup.status];
          const StatusIcon = statusConfig.icon;

          return (
            <div key={followup.id} className="relative pl-10">
              {/* Day badge (timeline node) */}
              <div className="absolute left-0 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-swan-500 shadow-sm">
                <span className="text-[10px] font-bold text-white">{followup.followupDay}</span>
              </div>

              {/* Card */}
              <div
                className={cn(
                  'rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
                  isOverdue ? 'border-red-300' : 'border-gray-200',
                )}
              >
                {/* Card header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">
                        Ngày {followup.followupDay.slice(1)} sau phẫu thuật
                      </span>
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          Quá hạn
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Hạn: {formatDateVN(followup.dueDate)}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
                      statusConfig.className,
                    )}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </span>
                </div>

                {/* Body details */}
                {(followup.customerCondition || followup.painLevel !== undefined) && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                    {followup.customerCondition && (
                      <p className="text-sm text-gray-600">{followup.customerCondition}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Đau:</span>
                        <SeverityDots value={followup.painLevel} color="bg-red-400" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Sưng:</span>
                        <SeverityDots value={followup.swellingLevel} color="bg-orange-400" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Bầm tím:</span>
                        <SeverityDots value={followup.bruisingLevel} color="bg-purple-400" />
                      </div>
                    </div>
                  </div>
                )}

                {followup.note && (
                  <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    📝 {followup.note}
                  </p>
                )}

                {followup.nextAction && (
                  <p className="mt-1.5 text-xs text-swan-600">
                    ➡ Hành động tiếp theo: {followup.nextAction}
                  </p>
                )}

                {/* Update button */}
                {canUpdate && !isExpanded && (
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpandedId(followup.id)}
                    >
                      Cập nhật
                    </Button>
                  </div>
                )}

                {/* Inline form */}
                {isExpanded && (
                  <FollowupForm
                    followup={followup}
                    onSubmit={(data) => handleUpdate(followup, data)}
                    onClose={() => setExpandedId(null)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
