'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon,
  Clock, MapPin, User as UserIcon,
} from 'lucide-react';
import { Appointment, User as UserType } from '@/lib/types';
import { getAllAppointments, getAllUsers, createAppointment } from '@/lib/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useToast } from '@/components/ui/toast';
import { formatDateVN } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

// ─── Constants ─────────────────────────────────────────────────────────────

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  consultation: 'Tư vấn',
  lab_test: 'Xét nghiệm',
  procedure: 'Phẫu thuật',
  checkup: 'Tái khám',
  postop_followup: 'Theo dõi hậu phẫu',
  hospital_coordination: 'Phối hợp bệnh viện',
};

const APPOINTMENT_TYPE_COLORS: Record<string, string> = {
  consultation: 'bg-blue-100 text-blue-700 border-blue-200',
  lab_test: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  procedure: 'bg-swan-100 text-swan-700 border-swan-200',
  checkup: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  postop_followup: 'bg-pink-100 text-pink-700 border-pink-200',
  hospital_coordination: 'bg-cyan-100 text-cyan-700 border-cyan-200',
};

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Đã xếp lịch',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
  no_show: 'Không đến',
};

const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
  no_show: 'bg-orange-100 text-orange-700',
};

const WEEKDAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

// ─── Helpers ───────────────────────────────────────────────────────────────

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { user: currentUser } = useCurrentUser();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    caseId: '',
    customerId: '',
    type: 'consultation' as string,
    title: '',
    startTime: '',
    endTime: '',
    note: '',
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [appts, users] = await Promise.all([getAllAppointments(), getAllUsers()]);
      setAppointments(appts);
      setAllUsers(users);
    } catch (err) {
      console.error('[Calendar] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Date navigation ────────────────────────────────────────────────────

  function navigatePrev() {
    const d = new Date(currentDate);
    if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  }

  function navigateNext() {
    const d = new Date(currentDate);
    if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  // ─── Filter appointments for current view ───────────────────────────────

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = startOfWeek(firstDay);
    const totalDays = 42; // 6 weeks
    return Array.from({ length: totalDays }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const visibleDays = viewMode === 'week' ? weekDays : monthDays;

  function getAppointmentsForDay(day: Date): Appointment[] {
    return appointments.filter((a) => {
      const apptDate = new Date(a.startTime);
      return isSameDay(apptDate, day);
    });
  }

  // ─── User map ───────────────────────────────────────────────────────────

  const usersMap = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers]);

  function getUserName(id: string): string {
    return usersMap.get(id)?.displayName ?? id;
  }

  // ─── Create appointment ─────────────────────────────────────────────────

  async function handleCreateAppointment() {
    if (!currentUser || !createForm.title || !createForm.startTime) return;
    setCreating(true);
    try {
      await createAppointment(
        {
          caseId: createForm.caseId || 'general',
          customerId: createForm.customerId || 'general',
          type: createForm.type as Appointment['type'],
          title: createForm.title,
          startTime: new Date(createForm.startTime).toISOString(),
          endTime: createForm.endTime ? new Date(createForm.endTime).toISOString() : undefined,
          note: createForm.note || undefined,
        },
        currentUser.id,
      );
      setCreateOpen(false);
      setCreateForm({ caseId: '', customerId: '', type: 'consultation', title: '', startTime: '', endTime: '', note: '' });
      await load();
    } catch (err) {
      console.error('[Calendar] Create appointment error:', err);
      toast('Không thể tạo lịch hẹn. Vui lòng thử lại.', 'error');
    } finally {
      setCreating(false);
    }
  }

  // ─── Header label ───────────────────────────────────────────────────────

  const headerLabel = useMemo(() => {
    if (viewMode === 'week') {
      const start = weekDays[0];
      const end = weekDays[6];
      const sMonth = start.getMonth() + 1;
      const eMonth = end.getMonth() + 1;
      if (sMonth === eMonth) {
        return `${start.getDate()} – ${end.getDate()}/${eMonth}/${end.getFullYear()}`;
      }
      return `${start.getDate()}/${sMonth} – ${end.getDate()}/${eMonth}/${end.getFullYear()}`;
    }
    const month = currentDate.getMonth() + 1;
    const year = currentDate.getFullYear();
    return `Tháng ${month}/${year}`;
  }, [currentDate, viewMode, weekDays]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-swan-100">
            <CalendarIcon className="h-5 w-5 text-swan-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lịch hẹn</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Quản lý lịch tư vấn, xét nghiệm, phẫu thuật và theo dõi
            </p>
          </div>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
          Tạo lịch hẹn
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[180px] text-center text-sm font-medium text-gray-900">
            {headerLabel}
          </span>
          <Button variant="outline" size="sm" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Hôm nay
          </Button>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
          <button
            onClick={() => setViewMode('week')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              viewMode === 'week' ? 'bg-swan-500 text-white' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            Tuần
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              viewMode === 'month' ? 'bg-swan-500 text-white' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            Tháng
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-swan-200 border-t-swan-500" />
          </div>
        ) : (
          <div
            className={cn(
              'grid',
              viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7',
            )}
          >
            {/* Weekday headers */}
            {WEEKDAY_NAMES.map((name) => (
              <div
                key={name}
                className="border-b border-r border-gray-100 bg-gray-50 px-2 py-2 text-center text-xs font-medium text-gray-500 last:border-r-0"
              >
                {name}
              </div>
            ))}

            {/* Day cells */}
            {visibleDays.map((day, idx) => {
              const dayAppts = getAppointmentsForDay(day);
              const today = isSameDay(day, new Date());
              const inMonth = day.getMonth() === currentDate.getMonth();

              return (
                <div
                  key={idx}
                  className={cn(
                    'min-h-[100px] border-b border-r border-gray-100 p-1.5 last:border-r-0',
                    viewMode === 'month' && !inMonth && 'bg-gray-50/50 opacity-60',
                    today && 'bg-swan-50/30',
                  )}
                >
                  {/* Day number */}
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                        today
                          ? 'bg-swan-500 text-white'
                          : inMonth
                            ? 'text-gray-700'
                            : 'text-gray-400',
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {dayAppts.length > 0 && (
                      <span className="text-[10px] font-medium text-gray-400">
                        {dayAppts.length}
                      </span>
                    )}
                  </div>

                  {/* Appointment chips */}
                  <div className="space-y-0.5">
                    {dayAppts.slice(0, viewMode === 'week' ? 10 : 3).map((appt) => (
                      <Link
                        key={appt.id}
                        href={`/cases/${appt.caseId}`}
                        className={cn(
                          'group block truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight transition-colors hover:opacity-80',
                          APPOINTMENT_TYPE_COLORS[appt.type] ?? 'bg-gray-100 text-gray-600',
                        )}
                        title={`${appt.title} — ${formatTime(appt.startTime)}`}
                      >
                        <span className="mr-1">{formatTime(appt.startTime)}</span>
                        {appt.title}
                      </Link>
                    ))}
                    {dayAppts.length > (viewMode === 'week' ? 10 : 3) && (
                      <span className="block px-1.5 text-[10px] font-medium text-gray-400">
                        +{dayAppts.length - (viewMode === 'week' ? 10 : 3)} nữa
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming appointments list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Lịch hẹn sắp tới</h2>
        {appointments
          .filter((a) => {
            const d = new Date(a.startTime);
            return d >= new Date() && a.status !== 'cancelled';
          })
          .slice(0, 10)
          .map((appt) => (
            <Link
              key={appt.id}
              href={`/cases/${appt.caseId}`}
              className="group flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-swan-200 hover:shadow-md"
            >
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-swan-50">
                <CalendarIcon className="h-5 w-5 text-swan-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900 group-hover:text-swan-700 transition-colors">
                    {appt.title}
                  </span>
                  <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', APPOINTMENT_TYPE_COLORS[appt.type] ?? '')}>
                    {APPOINTMENT_TYPE_LABELS[appt.type] ?? appt.type}
                  </span>
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', APPOINTMENT_STATUS_COLORS[appt.status] ?? '')}>
                    {APPOINTMENT_STATUS_LABELS[appt.status] ?? appt.status}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDateVN(appt.startTime)} {formatTime(appt.startTime)}
                    {appt.endTime && ` – ${formatTime(appt.endTime)}`}
                  </span>
                  {appt.assignedStaffIds.length > 0 && (
                    <span className="flex items-center gap-1">
                      <UserIcon className="h-3.5 w-3.5" />
                      {appt.assignedStaffIds.map((id) => getUserName(id)).join(', ')}
                    </span>
                  )}
                </div>
                {appt.note && (
                  <p className="mt-1 text-xs text-gray-400 truncate">{appt.note}</p>
                )}
              </div>
            </Link>
          ))}
      </div>

      {/* Create appointment modal */}
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreateForm({ caseId: '', customerId: '', type: 'consultation', title: '', startTime: '', endTime: '', note: '' });
        }}
        title="Tạo lịch hẹn mới"
        description="Điền thông tin để tạo lịch hẹn"
        size="lg"
      >
        <div className="space-y-4 p-6">
          <Input
            label="Tiêu đề *"
            placeholder="Nhập tiêu đề lịch hẹn..."
            value={createForm.title}
            onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Loại lịch hẹn"
              value={createForm.type}
              onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value }))}
            >
              {Object.entries(APPOINTMENT_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </Select>
            <Input
              label="Mã CA (tùy chọn)"
              placeholder="ID hồ sơ ca"
              value={createForm.caseId}
              onChange={(e) => setCreateForm((f) => ({ ...f, caseId: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Thời gian bắt đầu *"
              type="datetime-local"
              value={createForm.startTime}
              onChange={(e) => setCreateForm((f) => ({ ...f, startTime: e.target.value }))}
            />
            <Input
              label="Thời gian kết thúc"
              type="datetime-local"
              value={createForm.endTime}
              onChange={(e) => setCreateForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>

          <Textarea
            label="Ghi chú"
            rows={3}
            placeholder="Ghi chú về lịch hẹn..."
            value={createForm.note}
            onChange={(e) => setCreateForm((f) => ({ ...f, note: e.target.value }))}
          />

          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Hủy
            </Button>
            <Button
              isLoading={creating}
              onClick={handleCreateAppointment}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Tạo lịch hẹn
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
