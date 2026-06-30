'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, CheckCheck, Loader2, AlertCircle, DollarSign, Calendar,
  FileText, Image as ImageIcon, Activity, Stethoscope, MessageCircle,
  CheckCircle2, User as UserIcon,
} from 'lucide-react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Notification, NotificationEventType } from '@/lib/types';
import { cn } from '@/lib/utils/cn';

const EVENT_ICONS: Record<NotificationEventType, React.ElementType> = {
  new_case_created: FileText,
  payment_pending: DollarSign,
  payment_confirmed: CheckCircle2,
  payment_rejected: AlertCircle,
  hospital_coordination_required: Calendar,
  hospital_confirmed: CheckCircle2,
  lab_test_due: Activity,
  procedure_scheduled: Calendar,
  customer_checked_in: UserIcon,
  procedure_completed: Stethoscope,
  images_missing: ImageIcon,
  postop_followup_due: Activity,
  complaint: MessageCircle,
  medical_alert: AlertCircle,
  medical_alert_resolved: CheckCircle2,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'Trong app',
  telegram: 'Telegram',
  zalo_placeholder: 'Zalo',
};

type FilterTab = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');

  const currentUserId = user?.id ?? 'user-001';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/notifications?userId=${currentUserId}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications ?? []);
      }
    } catch (err) {
      console.error('Load notifications error:', err);
      toast('Không thể tải thông báo', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClick(n: Notification) {
    try {
      if (!n.readBy?.includes(currentUserId)) {
        const res = await fetch(`/api/notifications/${n.id}/read`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId }),
        });
        if (!res.ok) throw new Error('Mark read failed');
        setNotifications((prev) =>
          prev.map((x) =>
            x.id === n.id
              ? { ...x, readBy: [...(x.readBy ?? []), currentUserId] }
              : x,
          ),
        );
      }
      if (n.caseId) {
        router.push(`/cases/${n.caseId}`);
      } else if (n.customerId) {
        router.push(`/customers/${n.customerId}`);
      }
    } catch (err) {
      console.error('Mark notification read error:', err);
      toast('Không thể đánh dấu đã đọc', 'error');
    }
  }

  async function handleMarkAllRead() {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      if (!res.ok) throw new Error('Mark all read failed');
      setNotifications((prev) =>
        prev.map((x) => ({ ...x, readBy: [...(x.readBy ?? []), currentUserId] })),
      );
      toast('Đã đánh dấu tất cả là đã đọc', 'success');
    } catch (err) {
      console.error('Mark all read error:', err);
      toast('Không thể cập nhật trạng thái đọc', 'error');
    }
  }

  const filtered = notifications.filter((n) => {
    const isRead = n.readBy?.includes(currentUserId);
    if (filter === 'unread') return !isRead;
    if (filter === 'read') return isRead;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.readBy?.includes(currentUserId)).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-swan-500 to-swan-600 text-white shadow-glow-swan">
            <Bell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Thông báo</h1>
            <p className="text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả đã đọc'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<CheckCheck className="h-4 w-4" />}
            onClick={handleMarkAllRead}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      <Tabs
        items={[
          { id: 'all', label: `Tất cả (${notifications.length})` },
          { id: 'unread', label: `Chưa đọc (${unreadCount})` },
          { id: 'read', label: `Đã đọc (${notifications.length - unreadCount})` },
        ]}
        activeId={filter}
        onChange={(id) => setFilter(id as FilterTab)}
        variant="pill"
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900">
            {filter === 'unread'
              ? 'Không có thông báo chưa đọc'
              : filter === 'read'
              ? 'Chưa có thông báo đã đọc'
              : 'Chưa có thông báo nào'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const Icon = EVENT_ICONS[n.eventType] ?? Bell;
            const isUnread = !n.readBy?.includes(currentUserId);
            return (
              <Card
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'flex cursor-pointer items-start gap-4 p-4 transition-all hover:shadow-medium',
                  isUnread && 'border-l-4 border-l-swan-500 bg-swan-50/30',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
                    isUnread ? 'bg-swan-100 text-swan-600' : 'bg-gray-100 text-gray-500',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cn(
                        'text-sm',
                        isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700',
                      )}
                    >
                      {n.title}
                    </p>
                    {isUnread && (
                      <span className="rounded-full bg-swan-500 px-2 py-0.5 text-[10px] font-medium text-white">
                        Mới
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{n.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span>{relativeTime(n.createdAt)}</span>
                    <span>•</span>
                    <Badge variant="default">{CHANNEL_LABELS[n.channel]}</Badge>
                  </div>
                </div>

                {isUnread && (
                  <div className="h-2 w-2 flex-shrink-0 rounded-full bg-swan-500" />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}