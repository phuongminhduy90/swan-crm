'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllFollowups } from '@/lib/firestore/followups';
import { Followup, FollowupStatus } from '@/lib/types';
import { formatDateVN } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  PhoneCall,
  PhoneOff,
  TrendingUp,
} from 'lucide-react';

const STATUS_CONFIG: Record<FollowupStatus, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Chờ xử lý', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: Clock },
  contacted: { label: 'Đã liên hệ', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: PhoneCall },
  no_response: { label: 'Không liên hệ được', className: 'bg-amber-100 text-amber-700 border-amber-200', icon: PhoneOff },
  issue_reported: { label: 'Có vấn đề', className: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  completed: { label: 'Hoàn tất', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
};

function StatCard({
  label,
  count,
  color,
  icon: Icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div className={cn('flex items-center gap-4 rounded-xl border p-4 bg-white shadow-sm', color)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/80 shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-xs font-medium">{label}</p>
      </div>
    </div>
  );
}

function FollowupCard({ followup }: { followup: Followup }) {
  const config = STATUS_CONFIG[followup.status];
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-swan-500 px-2.5 py-0.5 text-xs font-bold text-white">
              {followup.followupDay}
            </span>
            <Link
              href={`/cases/${followup.caseId}`}
              className="text-sm font-semibold text-swan-600 hover:text-swan-700 hover:underline"
            >
              Xem ca #{followup.caseId.slice(-6).toUpperCase()}
            </Link>
          </div>
          <p className="text-xs text-gray-500">Hạn: {formatDateVN(followup.dueDate)}</p>
          {followup.customerCondition && (
            <p className="text-sm text-gray-600 line-clamp-2">{followup.customerCondition}</p>
          )}
        </div>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
            config.className,
          )}
        >
          <Icon className="h-3 w-3" />
          {config.label}
        </span>
      </div>
      {followup.note && (
        <p className="mt-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
          📝 {followup.note}
        </p>
      )}
    </div>
  );
}

function Section({
  title,
  followups,
  emptyText,
  accent,
}: {
  title: string;
  followups: Followup[];
  emptyText: string;
  accent: string;
}) {
  return (
    <div>
      <div className={cn('mb-3 flex items-center gap-2')}>
        <div className={cn('h-1 w-6 rounded-full', accent)} />
        <h2 className="text-sm font-semibold text-gray-700">
          {title}
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {followups.length}
          </span>
        </h2>
      </div>
      {followups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-6 text-center text-sm text-gray-400">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-3">
          {followups.map((f) => (
            <FollowupCard key={f.id} followup={f} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FollowupsPage() {
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Dùng local date (VN time) thay vì toISOString() (UTC) để tránh lệch ngày
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  useEffect(() => {
    getAllFollowups()
      .then(setFollowups)
      .catch(() => setError('Không thể tải danh sách theo dõi'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-swan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        {error}
      </div>
    );
  }

  if (followups.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Theo dõi hậu phẫu</h1>
          <p className="mt-1 text-sm text-gray-500">Quản lý lịch theo dõi D1–D90 cho tất cả ca</p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16 text-gray-400">
          <Clock className="mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">Chưa có lịch theo dõi</p>
          <p className="mt-1 text-sm">Lịch theo dõi sẽ được tạo tự động khi ca chuyển sang trạng thái hoàn thành</p>
        </div>
      </div>
    );
  }

  const toToday = followups.filter((f) => {
    const d = f.dueDate.slice(0, 10);
    return d === todayStr;
  });

  const overdue = followups.filter((f) => {
    const d = new Date(f.dueDate);
    d.setHours(0, 0, 0, 0);
    return d < today && f.status === 'pending';
  });

  const upcoming = followups.filter((f) => {
    const d = new Date(f.dueDate);
    d.setHours(0, 0, 0, 0);
    return d >= tomorrow && (f.status === 'pending' || f.status === 'contacted');
  });

  const issueCount = followups.filter((f) => f.status === 'issue_reported').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Theo dõi hậu phẫu</h1>
        <p className="mt-1 text-sm text-gray-500">Quản lý lịch theo dõi D1–D90 cho tất cả ca</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Hôm nay"
          count={toToday.length}
          color="border-swan-200 text-swan-700"
          icon={Calendar}
        />
        <StatCard
          label="Quá hạn"
          count={overdue.length}
          color="border-red-200 text-red-700"
          icon={AlertTriangle}
        />
        <StatCard
          label="Có vấn đề"
          count={issueCount}
          color="border-orange-200 text-orange-700"
          icon={TrendingUp}
        />
      </div>

      {/* Sections */}
      <div className="space-y-8">
        <Section
          title="Hôm nay"
          followups={toToday}
          emptyText="Không có lịch theo dõi hôm nay"
          accent="bg-swan-500"
        />
        <Section
          title="Quá hạn"
          followups={overdue}
          emptyText="Không có lịch quá hạn"
          accent="bg-red-500"
        />
        <Section
          title="Sắp tới"
          followups={upcoming}
          emptyText="Không có lịch theo dõi sắp tới"
          accent="bg-amber-400"
        />
      </div>
    </div>
  );
}
