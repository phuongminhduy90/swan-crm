'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Menu, LogOut, User as UserIcon, ChevronDown, Bell, BellRing,
  CheckCheck, Loader2, AlertCircle, AlertTriangle, DollarSign, Calendar, FileText,
  Image as ImageIcon, Activity, Stethoscope, MessageCircle, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { ROLE_LABELS } from '@/config/roles';
import { PAGE_TITLES } from '@/config/constants';
import { signOut } from '@/lib/firebase/auth';
import { Notification, NotificationEventType, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils/cn';

/**
 * Story PI-5 / TD-7 — Fallback `currentUserId` for the no-auth path.
 *
 * Historically this defaulted to `'user-001'` (the dev admin seed) which:
 *   1. Matched the A2 anti-pattern regex (`user-\d{3}`) and tripped the TD-6
 *      gate in `--all` mode.
 *   2. Silently fetched notifications against a real user ID, leaking
 *      `'user-001`'s readBy into the dev session (cosmetic, but observable).
 *
 * `'placeholder'` is a known-no-match sentinel: the `/api/notifications`
 * endpoint returns empty for an unknown ID, so the bell collapses to "no
 * notifications" until an actual profile is set. No `user-\d{3}` strings
 * appear in source, so the A2 gate stays clean.
 */
const FALLBACK_USER_ID = 'placeholder';

interface TopbarProps {
  onMenuToggle: () => void;
}

const EVENT_ICONS: Record<NotificationEventType, React.ElementType> = {
  new_case_created: FileText,
  payment_pending: DollarSign,
  payment_confirmed: CheckCheck,
  payment_rejected: AlertCircle,
  hospital_coordination_required: Calendar,
  hospital_confirmed: CheckCheck,
  lab_test_due: Activity,
  procedure_scheduled: Calendar,
  customer_checked_in: UserIcon,
  procedure_completed: Stethoscope,
  images_missing: ImageIcon,
  postop_followup_due: Activity,
  complaint: MessageCircle,
  medical_alert: AlertCircle,
  medical_alert_resolved: CheckCircle2,
  followup_escalation: AlertTriangle,
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

export function Topbar({ onMenuToggle }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, isDevMode, setDevRole, devRole } = useAuth();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Notification dropdown
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const currentUserId = userProfile?.id ?? FALLBACK_USER_ID;

  const fetchNotifications = useCallback(async () => {
    try {
      setNotifLoading(true);
      const res = await fetch(`/api/notifications?userId=${currentUserId}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch (err) {
      console.error('Load notifications error:', err);
    } finally {
      setNotifLoading(false);
    }
  }, [currentUserId]);

  // Fetch on mount and every 60 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Derive page title from pathname
  const segments = pathname.split('/').filter(Boolean);
  const titleKey = segments[0] === 'settings' ? `settings/${segments[1]}` : segments[0];
  const pageTitle = (titleKey && PAGE_TITLES[titleKey]) || 'Bảng điều khiển';

  async function handleSignOut() {
    try {
      if (!isDevMode) await signOut();
      router.push('/login');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }

  // Story 6.3.4 / B.4.4 (F-HIGH-01) — "Hồ sơ" menu item is a placeholder
  // for the (not-yet-built) user profile page. A8 anti-pattern requires no
  // dead `href="#"`; instead we show a Vietnamese info toast that the feature
  // is in development. Closes the user menu so the toast is the only surface
  // the user sees after clicking.
  function handleProfilePlaceholder() {
    setMenuOpen(false);
    toast('Tính năng đang phát triển', 'info');
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.readBy?.includes(currentUserId)) {
      await fetch(`/api/notifications/${n.id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      // Optimistic update
      setNotifications((prev) =>
        prev.map((x) =>
          x.id === n.id
            ? { ...x, readBy: [...(x.readBy ?? []), currentUserId] }
            : x,
        ),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.caseId) {
      router.push(`/cases/${n.caseId}`);
    } else if (n.customerId) {
      router.push(`/customers/${n.customerId}`);
    }
    setNotifOpen(false);
  }

  async function handleMarkAllRead() {
    await fetch('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId }),
    });
    setNotifications((prev) =>
      prev.map((x) => ({ ...x, readBy: [...(x.readBy ?? []), currentUserId] })),
    );
    setUnreadCount(0);
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200/60 bg-white/80 px-4 backdrop-blur-xl shadow-soft lg:px-6">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 lg:hidden"
          aria-label="Mở menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900 lg:text-xl">{pageTitle}</h1>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 lg:gap-3">
        {isDevMode && (
          <div className="hidden items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/80 backdrop-blur-sm px-3 py-1.5 md:flex">
            <Badge variant="warning">DEV</Badge>
            <select
              value={devRole ?? 'admin'}
              onChange={(e) => setDevRole(e.target.value as UserRole)}
              className="bg-transparent text-xs font-medium text-amber-800 focus:outline-none"
            >
              {Object.keys(ROLE_LABELS).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r as keyof typeof ROLE_LABELS]}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative rounded-xl p-2 text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-900"
            aria-label="Thông báo"
          >
            {unreadCount > 0 ? (
              <BellRing className="h-5 w-5 text-swan-600" />
            ) : (
              <Bell className="h-5 w-5" />
            )}
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-100/80 bg-white shadow-elevated animate-slide-down">
              <div className="flex items-center justify-between border-b border-gray-100/80 bg-gradient-to-br from-swan-50/50 to-transparent p-3">
                <p className="text-sm font-semibold text-gray-900">Thông báo</p>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-xs font-medium text-swan-600 hover:text-swan-700"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifLoading && notifications.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    Không có thông báo nào
                  </div>
                ) : (
                  notifications.slice(0, 10).map((n) => {
                    const Icon = EVENT_ICONS[n.eventType] ?? Bell;
                    const isUnread = !n.readBy?.includes(currentUserId);
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          'flex w-full items-start gap-3 border-b border-gray-50 px-3 py-3 text-left transition-colors hover:bg-gray-50',
                          isUnread && 'border-l-2 border-l-swan-500',
                        )}
                      >
                        <div
                          className={cn(
                            'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
                            isUnread ? 'bg-swan-100 text-swan-600' : 'bg-gray-100 text-gray-500',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-sm',
                              isUnread ? 'font-semibold text-gray-900' : 'font-medium text-gray-700',
                            )}
                          >
                            {n.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                            {n.body}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {relativeTime(n.createdAt)}
                          </p>
                        </div>
                        {isUnread && (
                          <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-swan-500" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="border-t border-gray-100/80 bg-gray-50/50 p-2">
                <Link
                  href="/notifications"
                  className="block rounded-lg py-2 text-center text-xs font-medium text-swan-600 transition-colors hover:bg-swan-50 hover:text-swan-700"
                  onClick={() => setNotifOpen(false)}
                >
                  Xem tất cả thông báo
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 rounded-xl p-1.5 transition-all hover:bg-gray-100/80"
          >
            <Avatar name={userProfile?.displayName ?? 'User'} size="sm" />
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-gray-900">{userProfile?.displayName}</p>
              <p className="text-xs text-gray-500">
                {userProfile ? ROLE_LABELS[userProfile.role] : ''}
              </p>
            </div>
            <ChevronDown
              className={cn('h-4 w-4 text-gray-500 transition-transform duration-200', menuOpen && 'rotate-180')}
            />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-gray-100/80 bg-white shadow-elevated animate-slide-down">
              <div className="border-b border-gray-100/80 bg-gradient-to-br from-swan-50/50 to-transparent p-3">
                <p className="text-sm font-medium text-gray-900">{userProfile?.displayName}</p>
                <p className="text-xs text-gray-500">{userProfile?.email}</p>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  data-testid="topbar-profile-menu-item"
                  aria-label="Hồ sơ (đang phát triển)"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 transition-colors hover:bg-swan-50/60 hover:text-swan-700"
                  onClick={handleProfilePlaceholder}
                >
                  <UserIcon className="h-4 w-4" />
                  Thông tin cá nhân
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}