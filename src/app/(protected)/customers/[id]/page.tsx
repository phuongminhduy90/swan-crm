'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronRight, Phone, Calendar, Globe, Lock, FileText,
  AlertCircle, Edit2, Trash2, User, MessageCircle, Briefcase, Clock,
  Shield, Loader2, PhoneCall, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import {
  getCustomer, getCasesByCustomer, updateCustomer, deleteCustomer, requestCustomerDeletion,
  approveCustomerDeletion, writeAuditLog,
} from '@/lib/firestore';
import { Customer, CaseRecord, PrivacyLevel, User as UserType, Followup, FollowupStatus } from '@/lib/types';
import { getAllUsers } from '@/lib/firestore/users';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tabs, TabItem } from '@/components/ui/tabs';
import { CustomerForm } from '@/components/customers';
import { CaseStatusBadge } from '@/components/cases/status-badge';
import { formatDateVN, formatPhone, formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/config/roles';
import { SENSITIVE_FIELD_ACCESS_ROLES, MEDICAL_NOTE_ACCESS_ROLES, DELETE_APPROVE_ROLES } from '@/constants/permissions';
import { CreateCustomerFormValues } from '@/lib/validators/customer';
import { SERVICE_CATEGORY_LABELS } from '@/constants/service-categories';
import { useToast } from '@/components/ui/toast';
import { ConsentPanel } from '@/components/consents';

// ─── Constants ───────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  online: 'Online', offline: 'Offline', walk_in: 'Đến trực tiếp',
  referral: 'Giới thiệu', koc: 'KOC/KOL', old_data: 'Dữ liệu cũ', other: 'Khác',
};
const GENDER_LABELS: Record<string, string> = {
  female: 'Nữ', male: 'Nam', other: 'Khác', unknown: 'Không rõ',
};
const PRIVACY_LEVEL_CONFIG: Record<PrivacyLevel, { label: string; variant: 'default' | 'gold' | 'danger' }> = {
  normal: { label: 'Bình thường', variant: 'default' },
  vip: { label: 'VIP', variant: 'gold' },
  highly_sensitive: { label: 'Nhạy cảm cao', variant: 'danger' },
};

const FOLLOWUP_STATUS_CONFIG: Record<FollowupStatus, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Chờ xử lý', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: Clock },
  contacted: { label: 'Đã liên hệ', className: 'bg-blue-100 text-blue-700 border-blue-200', icon: PhoneCall },
  no_response: { label: 'Không liên hệ được', className: 'bg-amber-100 text-amber-700 border-amber-200', icon: Phone },
  issue_reported: { label: 'Có vấn đề', className: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  completed: { label: 'Hoàn tất', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50/80 last:border-0">
      {icon && <div className="mt-0.5 flex-shrink-0 text-gray-400">{icon}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <div className="mt-0.5 text-sm text-gray-800">{value || '—'}</div>
      </div>
    </div>
  );
}

function SensitiveField({ label, value, icon, canView }: { label: string; value: React.ReactNode; icon?: React.ReactNode; canView: boolean }) {
  if (!canView) {
    return (
      <div className="flex items-start gap-3 py-3 border-b border-gray-50/80 last:border-0">
        {icon && <div className="mt-0.5 flex-shrink-0 text-gray-300">{icon}</div>}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
            <Lock className="h-3 w-3" />
            <span>Bị hạn chế bởi vai trò</span>
          </div>
        </div>
      </div>
    );
  }
  return <InfoRow label={label} value={value} icon={icon} />;
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

const TABS: TabItem[] = [
  { id: 'info', label: 'Thông tin' },
  { id: 'cases', label: 'Lịch sử ca' },
  { id: 'followups', label: 'Theo dõi sau PT' },
  { id: 'consents', label: 'Consent' },
  { id: 'timeline', label: 'Timeline' },
];

// ─── Main component ───────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params?.id as string;
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [requestDelete, setRequestDelete] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [approveDelete, setApproveDelete] = useState(false);
  const [approving, setApproving] = useState(false);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [followupsLoading, setFollowupsLoading] = useState(false);

  const canWrite = !!user && hasPermission(user.role, 'customers:write');
  const canViewSensitive = !!user && SENSITIVE_FIELD_ACCESS_ROLES.includes(user.role);
  const canViewMedical = !!user && MEDICAL_NOTE_ACCESS_ROLES.includes(user.role);
  const canDeleteApprove = !!user && DELETE_APPROVE_ROLES.includes(user.role);

  // Only the creator (or master_sales) can edit their own customer
  const isCreator = user && customer?.createdBy === user.id;
  const canEditCustomer = canWrite && (isCreator || user?.role === 'admin' || user?.role === 'master_sales' || user?.role === 'cso' || user?.role === 'ceo');

  const usersMap = new Map(allUsers.map((u) => [u.id, u]));
  const getUserName = (id?: string) => {
    if (!id) return '—';
    return usersMap.get(id)?.displayName ?? id;
  };

  // ── Load customer + users ──────────────────────────────────────────────────
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [data, users] = await Promise.all([
          getCustomer(customerId),
          getAllUsers(),
        ]);
        if (!cancelled) {
          setAllUsers(users);
          if (!data) setNotFound(true);
          else setCustomer(data);
        }
      } catch (err) {
        console.error('[CustomerDetail] Failed to load customer:', err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [customerId]);

  // ── Load cases when tab switches ──────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'cases' || !customerId) return;
    let cancelled = false;
    async function loadCases() {
      try {
        setCasesLoading(true);
        const data = await getCasesByCustomer(customerId);
        if (!cancelled) {
          data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setCases(data);
        }
      } catch (err) {
        console.error('[CustomerDetail] Failed to load cases:', err);
      } finally {
        if (!cancelled) setCasesLoading(false);
      }
    }
    loadCases();
    return () => { cancelled = true; };
  }, [activeTab, customerId]);

  // ── Load followups when tab switches ──────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'followups' || !customerId) return;
    let cancelled = false;
    async function loadFollowups() {
      try {
        setFollowupsLoading(true);
        const { getAllFollowups } = await import('@/lib/firestore/followups');
        const allFollowups = await getAllFollowups();
        if (!cancelled) {
          setFollowups(allFollowups.filter((f) => f.customerId === customerId));
        }
      } catch (err) {
        console.error('[CustomerDetail] Failed to load followups:', err);
      } finally {
        if (!cancelled) setFollowupsLoading(false);
      }
    }
    loadFollowups();
    return () => { cancelled = true; };
  }, [activeTab, customerId]);

  // ── Edit submit ───────────────────────────────────────────────────────────
  async function handleEditSubmit(data: CreateCustomerFormValues) {
    if (!user || !customer) return;
    setEditLoading(true);
    try {
      await updateCustomer(customer.id, data, user.id);
      await writeAuditLog({
        actorId: user.id, actorName: user.displayName, actorRole: user.role,
        action: 'customer_updated', entityType: 'customer', entityId: customer.id,
        before: customer as unknown as Record<string, unknown>,
        after: data as unknown as Record<string, unknown>,
      });
      const updated = await getCustomer(customer.id);
      if (updated) setCustomer(updated);
      setEditOpen(false);
      toast('Đã cập nhật thông tin khách hàng', 'success');
    } catch (err) {
      console.error('[CustomerDetail] Failed to update customer:', err);
      toast('Không thể cập nhật khách hàng', 'error');
    } finally {
      setEditLoading(false);
    }
  }

  // ── Request Delete ────────────────────────────────────────────────────────
  async function handleRequestDelete() {
    if (!customer || !user) return;
    setRequesting(true);
    try {
      await requestCustomerDeletion(customer.id, 'Yêu cầu xóa từ người tạo', user.id);
      toast('Đã gửi yêu cầu xóa. Chờ quản lý phê duyệt.', 'info');
      setRequestDelete(false);
      const updated = await getCustomer(customer.id);
      if (updated) setCustomer(updated);
    } catch (err) {
      console.error('[CustomerDetail] Request delete failed:', err);
      toast('Không thể gửi yêu cầu xóa', 'error');
    } finally {
      setRequesting(false);
    }
  }

  // ── Approve Delete ────────────────────────────────────────────────────────
  async function handleApproveDelete() {
    if (!customer || !user) return;
    setApproving(true);
    try {
      await approveCustomerDeletion(customer.id, user.id);
      await deleteCustomer(customer.id);
      toast(`Đã xóa khách hàng ${customer.fullName}`, 'success');
      router.push('/customers');
    } catch (err) {
      console.error('[CustomerDetail] Approve delete failed:', err);
      toast('Không thể xóa khách hàng', 'error');
      setApproving(false);
      setApproveDelete(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-swan-200 border-t-swan-500" />
          <p className="text-sm">Đang tải hồ sơ...</p>
        </div>
      </div>
    );
  }

  if (notFound || !customer) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-gray-400">
        <AlertCircle className="h-12 w-12 opacity-30" />
        <div className="text-center">
          <p className="text-base font-medium">Không tìm thấy khách hàng</p>
          <p className="mt-1 text-sm">Hồ sơ này có thể đã bị xóa hoặc không tồn tại</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/customers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const privacyCfg = PRIVACY_LEVEL_CONFIG[customer.privacyLevel];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/customers" className="flex items-center gap-1 hover:text-swan-600 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Khách hàng
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-900 truncate">{customer.fullName}</span>
      </nav>

      {/* Pending deletion banner */}
      {customer.deletionRequested && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 backdrop-blur-sm animate-slide-down">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">Yêu cầu xóa đang chờ phê duyệt</p>
              <p className="mt-0.5 text-xs text-amber-700">
                Yêu cầu bởi <strong>{getUserName(customer.deletionRequestedBy)}</strong> lúc {formatDateVN(customer.deletionRequestedAt)}
              </p>
              {customer.deletionReason && (
                <p className="mt-1 text-xs text-amber-700">Lý do: {customer.deletionReason}</p>
              )}
            </div>
            {canDeleteApprove && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRequestDelete(false)}
                >
                  Từ chối
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  isLoading={approving}
                  onClick={() => setApproveDelete(true)}
                >
                  Phê duyệt xóa
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header card — premium glass style */}
      <div className="rounded-2xl border border-white/60 bg-white/80 backdrop-blur-xl p-6 shadow-elevated">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-swan-500 to-swan-600 text-white shadow-lg shadow-swan-500/20">
              <User className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              {customer.customerCode && (
                <span className="mb-1 inline-flex items-center rounded-md bg-swan-50 px-2 py-0.5 text-xs font-mono font-semibold text-swan-700">
                  {customer.customerCode}
                </span>
              )}
              <h1 className="text-2xl font-bold text-gray-900">{customer.fullName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {formatPhone(customer.phone)}
                </span>
                {customer.gender && <span>{GENDER_LABELS[customer.gender] ?? customer.gender}</span>}
                {customer.dateOfBirth && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDateVN(customer.dateOfBirth)}
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {privacyCfg && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    privacyCfg.variant === 'gold' ? 'bg-gradient-to-r from-champagne-50 to-champagne-100 text-champagne-700' :
                    privacyCfg.variant === 'danger' ? 'bg-red-50 text-red-700' :
                    'bg-gray-100/80 text-gray-600'
                  }`}>
                    {privacyCfg.label}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <User className="h-3 w-3" />
                  NV tạo: <strong className="text-gray-700">{getUserName(customer.createdBy)}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {canEditCustomer && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Edit2 className="h-4 w-4" />}
                onClick={() => setEditOpen(true)}
              >
                Chỉnh sửa
              </Button>
            )}
            {canWrite && !customer.deletionRequested && (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => setRequestDelete(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Yêu cầu xóa
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        items={TABS}
        activeId={activeTab}
        onChange={setActiveTab}
      />

      {/* ── Tab: Thông tin ────────────────────────────────────────────────── */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-swan-600">Thông tin cơ bản</h3>
            <InfoRow label="Họ tên" value={customer.fullName} icon={<User className="h-4 w-4" />} />
            <InfoRow label="Điện thoại chính" value={formatPhone(customer.phone)} icon={<Phone className="h-4 w-4" />} />
            {customer.secondaryPhone && (
              <InfoRow label="Điện thoại phụ" value={formatPhone(customer.secondaryPhone)} icon={<Phone className="h-4 w-4" />} />
            )}
            <InfoRow label="Ngày sinh" value={formatDateVN(customer.dateOfBirth)} icon={<Calendar className="h-4 w-4" />} />
            <InfoRow label="Giới tính" value={customer.gender ? (GENDER_LABELS[customer.gender] ?? customer.gender) : null} />
            <InfoRow label="Nguồn" value={customer.source ? (SOURCE_LABELS[customer.source] ?? customer.source) : null} icon={<Globe className="h-4 w-4" />} />
            {customer.sourceDetail && <InfoRow label="Chi tiết nguồn" value={customer.sourceDetail} />}
            <InfoRow label="Ngày tạo" value={formatDateVN(customer.createdAt)} icon={<Clock className="h-4 w-4" />} />
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-swan-600">Liên hệ & Mạng xã hội</h3>
            <InfoRow label="Zalo" value={customer.zalo} icon={<MessageCircle className="h-4 w-4" />} />
            <InfoRow label="Facebook" value={
              customer.facebook ? (
                <a
                  href={customer.facebook.startsWith('http') ? customer.facebook : `https://facebook.com/${customer.facebook}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-swan-600 hover:underline"
                >
                  {customer.facebook}
                </a>
              ) : null
            } icon={<Globe className="h-4 w-4" />} />
            <SensitiveField label="Địa chỉ" value={customer.address} canView={canViewSensitive} />
            {customer.emergencyContactName && (
              <InfoRow label="Người liên hệ khẩn" value={`${customer.emergencyContactName}${customer.emergencyContactPhone ? ` — ${formatPhone(customer.emergencyContactPhone)}` : ''}`} icon={<Phone className="h-4 w-4" />} />
            )}
          </Card>

          <Card className="lg:col-span-2">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-swan-600">Ghi chú</h3>
            <SensitiveField label="Ghi chú y tế" value={customer.medicalNote ? <p className="whitespace-pre-wrap text-sm">{customer.medicalNote}</p> : null} canView={canViewMedical} icon={<FileText className="h-4 w-4" />} />
            <SensitiveField label="Ghi chú riêng tư" value={customer.privacyNote ? <p className="whitespace-pre-wrap text-sm">{customer.privacyNote}</p> : null} canView={canViewSensitive} icon={<Lock className="h-4 w-4" />} />
          </Card>
        </div>
      )}

      {/* ── Tab: Lịch sử ca ──────────────────────────────────────────────── */}
      {activeTab === 'cases' && (
        <div className="space-y-3">
          {casesLoading ? (
            <div className="flex min-h-40 items-center justify-center text-gray-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-swan-200 border-t-swan-500" />
            </div>
          ) : cases.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Briefcase className="mb-3 h-10 w-10 opacity-30" />
              <p className="font-medium">Chưa có ca nào</p>
              <p className="mt-1 text-sm">Khách hàng này chưa có hồ sơ ca nào</p>
            </Card>
          ) : (
            cases.map((c) => (
              <Link
                key={c.id}
                href={`/cases/${c.id}`}
                className="block rounded-2xl border border-gray-100/80 bg-white p-4 shadow-soft transition-all hover:shadow-medium hover:border-swan-100 hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-swan-50 px-2 py-0.5 text-xs font-mono font-semibold text-swan-700">
                        {c.caseCode}
                      </span>
                      <CaseStatusBadge status={c.status} size="sm" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full bg-gray-100/80 px-2.5 py-0.5 text-xs text-gray-600">
                        {SERVICE_CATEGORY_LABELS[c.mainServiceGroup] ?? c.mainServiceGroup}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right text-sm text-gray-500">
                    <p>{formatCurrency(c.totalBillAfterDiscount)}</p>
                    <p className="mt-0.5 text-xs">{formatDateVN(c.caseDate)}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* ── Tab: Theo dõi sau PT ──────────────────────────────────────────── */}
      {activeTab === 'followups' && (
        <div className="space-y-3">
          {followupsLoading ? (
            <div className="flex min-h-40 items-center justify-center text-gray-400">
              <Loader2 className="h-6 w-6 animate-spin text-swan-500" />
            </div>
          ) : followups.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Clock className="mb-3 h-10 w-10 opacity-30" />
              <p className="font-medium">Chưa có lịch theo dõi hậu phẫu</p>
              <p className="mt-1 text-sm">Lịch theo dõi sẽ được tạo tự động khi ca chuyển sang trạng thái hoàn thành</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {followups.map((f) => {
                const config = FOLLOWUP_STATUS_CONFIG[f.status];
                const Icon = config.icon;
                return (
                  <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-swan-500 px-2.5 py-0.5 text-xs font-bold text-white">
                            {f.followupDay}
                          </span>
                          <Link
                            href={`/cases/${f.caseId}`}
                            className="text-sm font-semibold text-swan-600 hover:text-swan-700 hover:underline"
                          >
                            Xem ca #{f.caseId.slice(-6).toUpperCase()}
                          </Link>
                        </div>
                        <p className="text-xs text-gray-500">Hạn: {formatDateVN(f.dueDate)}</p>
                        {f.customerCondition && (
                          <p className="text-sm text-gray-600 line-clamp-2">{f.customerCondition}</p>
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
                    {f.note && (
                      <p className="mt-2 rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
                        {f.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Timeline ─────────────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <Card className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Clock className="mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">Timeline đang phát triển</p>
          <p className="mt-1 text-sm">Tính năng này sẽ sớm ra mắt</p>
        </Card>
      )}

      {/* ── Tab: Consent ──────────────────────────────────────────────────── */}
      {activeTab === 'consents' && (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Quản lý Consent</h2>
          </div>
          <ConsentPanel
            customerId={customer.id}
            canWrite={canWrite}
          />
        </Card>
      )}

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Chỉnh sửa khách hàng"
        description={`Cập nhật thông tin hồ sơ ${customer.fullName}`}
        size="xl"
      >
        <div className="p-6">
          <CustomerForm
            initialData={customer}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
            loading={editLoading}
          />
        </div>
      </Modal>

      {/* ── Request Delete Confirm ─────────────────────────────────────────── */}
      <ConfirmDialog
        open={requestDelete}
        onClose={() => setRequestDelete(false)}
        onConfirm={handleRequestDelete}
        title="Gửi yêu cầu xóa khách hàng?"
        description={
          <span>
            Yêu cầu xóa <strong>{customer.fullName}</strong> sẽ được gửi đến CS/CEO/Trưởng KD để phê duyệt.
          </span>
        }
        confirmLabel="Gửi yêu cầu"
        cancelLabel="Hủy"
        variant="warning"
        loading={requesting}
      />

      {/* ── Approve Delete Confirm ─────────────────────────────────────────── */}
      <ConfirmDialog
        open={approveDelete}
        onClose={() => setApproveDelete(false)}
        onConfirm={handleApproveDelete}
        title="Phê duyệt xóa khách hàng?"
        description={
          <span>
            Xác nhận xóa vĩnh viễn khách hàng <strong>{customer.fullName}</strong>?
            Hành động này không thể hoàn tác.
          </span>
        }
        confirmLabel="Xóa vĩnh viễn"
        cancelLabel="Hủy"
        variant="danger"
        loading={approving}
      />
    </div>
  );
}
