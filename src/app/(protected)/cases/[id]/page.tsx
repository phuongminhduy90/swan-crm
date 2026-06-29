'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronRight, AlertCircle, Edit2, User, Calendar,
  FileText, Clock, Plus, Trash2, DollarSign, Briefcase,
  Shield, Paperclip, Upload as UploadIcon,
} from 'lucide-react';
import {
  getCustomer, getCase, getCaseServices, updateCase, updateCaseStatus,
  addCaseService, removeCaseService, getStaffAssignment, updateStaffAssignment,
  getAllUsers, getAllServices, getAllTreatmentLocations, createPayment, writeAuditLog,
} from '@/lib/firestore';
import {
  CaseRecord, CaseService, Customer, StaffAssignment, User as UserType,
  Service, TreatmentLocation,
} from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CaseStatusBadge } from '@/components/cases/status-badge';
import { BillSummary } from '@/components/cases/bill-summary';
import { PaymentList } from '@/components/payments/payment-list';
import { PaymentForm } from '@/components/payments/payment-form';
import { formatDateVN, formatPhone, formatCurrency } from '@/lib/utils/format';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { hasPermission } from '@/config/roles';
import {
  CASE_STATUS_CHANGE_ROLES, PAYMENT_CREATE_ROLES, MEDICAL_NOTE_ACCESS_ROLES,
} from '@/constants/permissions';
import { CASE_STATUS_LABELS, CASE_STATUS_TRANSITIONS } from '@/constants/case-status';
import { SERVICE_CATEGORY_LABELS } from '@/constants/service-categories';
import { addCaseServiceSchema } from '@/lib/validators/case';
import { CreatePaymentFormValues } from '@/lib/validators/payment';
import { ChecklistPanel } from '@/components/checklist';
import { StatusWorkflow } from '@/components/cases/status-workflow';
import { AttachmentList, AttachmentUploadDialog } from '@/components/attachments';
import { ConsentPanel } from '@/components/consents';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { cn } from '@/lib/utils/cn';

// ─── Types ───────────────────────────────────────────────────────────────

type Tab = 'info' | 'services' | 'payments' | 'staff' | 'attachments' | 'consents' | 'timeline';

interface StaffFieldConfig {
  key: string;
  field: keyof StaffAssignment;
  label: string;
  allowedRoles: string[];
  multi?: boolean;
}

const STAFF_FIELDS: StaffFieldConfig[] = [
  { key: 'masterSalesId', field: 'masterSalesId', label: 'Trưởng kinh doanh', allowedRoles: ['master_sales'] },
  { key: 'salesOnlineId', field: 'salesOnlineId', label: 'Kinh doanh Online', allowedRoles: ['sales_online'] },
  { key: 'salesOfflineId', field: 'salesOfflineId', label: 'Kinh doanh Offline', allowedRoles: ['sales_offline'] },
  { key: 'accountantId', field: 'accountantId', label: 'Kế toán', allowedRoles: ['accountant'] },
  { key: 'doctorId', field: 'doctorId', label: 'Bác sĩ', allowedRoles: ['doctor'] },
  { key: 'nurseIds', field: 'nurseIds', label: 'Y tá', allowedRoles: ['nurse'], multi: true },
  { key: 'coordinatorId', field: 'coordinatorId', label: 'Điều phối viên', allowedRoles: ['coordinator'] },
  { key: 'cskhPostopId', field: 'cskhPostopId', label: 'CSKH sau PT', allowedRoles: ['cskh_postop'] },
  { key: 'mediaId', field: 'mediaId', label: 'Media', allowedRoles: ['media'] },
];

const PRIVACY_CONFIG: Record<string, { label: string; variant: 'default' | 'gold' | 'danger' }> = {
  normal: { label: 'Bình thường', variant: 'default' },
  vip: { label: 'VIP', variant: 'gold' },
  highly_sensitive: { label: 'Nhạy cảm cao', variant: 'danger' },
};

const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn cấp',
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'info', label: 'Thông tin' },
  { id: 'services', label: 'Dịch vụ' },
  { id: 'payments', label: 'Thanh toán' },
  { id: 'staff', label: 'Phân công' },
  { id: 'attachments', label: 'Đính kèm' },
  { id: 'consents', label: 'Consent' },
  { id: 'timeline', label: 'Timeline' },
];

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      {icon && <div className="mt-0.5 flex-shrink-0 text-gray-400">{icon}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <div className="mt-0.5 text-sm text-gray-800">{value || '—'}</div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params?.id as string;
  const { user } = useCurrentUser();

  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [caseServices, setCaseServices] = useState<CaseService[]>([]);
  const [staffAssignment, setStaffAssignment] = useState<StaffAssignment | null>(null);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);
  const [allLocations, setAllLocations] = useState<TreatmentLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [refreshKey, setRefreshKey] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);

  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceSubmitting, setServiceSubmitting] = useState(false);
  const [serviceError, setServiceError] = useState<string | null>(null);

  const [staffEditOpen, setStaffEditOpen] = useState(false);
  const [staffSaving, setStaffSaving] = useState(false);

  const [attachmentUploadOpen, setAttachmentUploadOpen] = useState(false);

  const [statusChanging, setStatusChanging] = useState(false);

  const canWrite = !!user && hasPermission(user.role, 'cases:write');
  const canStatusChange = !!user && CASE_STATUS_CHANGE_ROLES.includes(user.role);
  const canPaymentCreate = !!user && PAYMENT_CREATE_ROLES.includes(user.role);
  const canViewMedical = !!user && MEDICAL_NOTE_ACCESS_ROLES.includes(user.role);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!caseId) return;
      try {
        setLoading(true);
        const c = await getCase(caseId);
        if (!c) { if (!cancelled) setNotFound(true); return; }
        if (cancelled) return;
        setCaseRecord(c);

        const [cust, services, staff, users, locs] = await Promise.all([
          getCustomer(c.customerId),
          getCaseServices(caseId),
          getStaffAssignment(caseId),
          getAllUsers(),
          getAllTreatmentLocations(),
        ]);
        if (cancelled) return;
        setCustomer(cust);
        setCaseServices(services);
        setStaffAssignment(staff);
        setAllUsers(users);
        setAllLocations(locs);
      } catch (err) {
        console.error('[CaseDetail] Failed to load:', err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [caseId, refreshKey]);

  function reload() { setRefreshKey((k) => k + 1); }

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!caseRecord) return;
    const form = new FormData(e.currentTarget);
    setEditLoading(true);
    try {
      const data: Record<string, unknown> = {};
      const priority = form.get('priority') as string;
      const privacyLevel = form.get('privacyLevel') as string;
      const expectedLabDate = form.get('expectedLabDate') as string;
      const expectedProcedureDate = form.get('expectedProcedureDate') as string;
      const salesNote = form.get('salesNote') as string;
      const medicalNote = form.get('medicalNote') as string;
      const internalNote = form.get('internalNote') as string;
      if (priority) data.priority = priority;
      if (privacyLevel) data.privacyLevel = privacyLevel;
      data.expectedLabDate = expectedLabDate || undefined;
      data.expectedProcedureDate = expectedProcedureDate || undefined;
      data.salesNote = salesNote || undefined;
      if (canViewMedical) data.medicalNote = medicalNote || undefined;
      data.internalNote = internalNote || undefined;
      await updateCase(caseId, data, user?.id ?? 'dev-user');
      await writeAuditLog({
        actorId: user?.id ?? 'dev-user', actorName: user?.displayName ?? 'Dev',
        actorRole: user?.role ?? 'admin', action: 'case_updated', entityType: 'case',
        entityId: caseId, after: data,
      });
      reload();
      setEditOpen(false);
    } catch (err) {
      console.error('[CaseDetail] Edit error:', err);
    } finally {
      setEditLoading(false);
    }
  }

  // Status change is handled by StatusWorkflow's onTransition callback below

  const {
    register: regService, handleSubmit: handleSubmitService, reset: resetServiceForm,
    formState: { errors: serviceErrors },
  } = useForm<z.infer<typeof addCaseServiceSchema>>({
    resolver: zodResolver(addCaseServiceSchema),
    defaultValues: {
      serviceCategory: 'nose', quantity: 1,
      isMainService: false, isGift: false, isUpsell: false,
    },
  });

  async function onAddService(data: z.infer<typeof addCaseServiceSchema>) {
    setServiceError(null);
    setServiceSubmitting(true);
    try {
      await addCaseService({ caseId, ...data });
      resetServiceForm();
      setServiceModalOpen(false);
      reload();
    } catch (err) {
      setServiceError('Không thể thêm dịch vụ. Vui lòng thử lại.');
      console.error('[CaseDetail] Add service error:', err);
    } finally {
      setServiceSubmitting(false);
    }
  }

  async function handleRemoveService(serviceId: string) {
    if (!confirm('Xóa dịch vụ này?')) return;
    try {
      await removeCaseService(serviceId);
      reload();
    } catch (err) {
      console.error('[CaseDetail] Remove service error:', err);
    }
  }

  async function handleStaffSave(formData: Record<string, unknown>) {
    setStaffSaving(true);
    try {
      const payload = formData as Parameters<typeof updateStaffAssignment>[1];
      await updateStaffAssignment(caseId, payload, user?.id ?? 'dev-user');
      await writeAuditLog({
        actorId: user?.id ?? 'dev-user', actorName: user?.displayName ?? 'Dev',
        actorRole: user?.role ?? 'admin', action: 'staff_assignment_changed',
        entityType: 'case', entityId: caseId, after: formData,
      });
      reload();
      setStaffEditOpen(false);
    } catch (err) {
      console.error('[CaseDetail] Staff save error:', err);
    } finally {
      setStaffSaving(false);
    }
  }

  const usersMap = new Map(allUsers.map((u) => [u.id, u]));
  function getUserName(id: string | undefined): string {
    if (!id) return 'Chưa phân công';
    return usersMap.get(id)?.displayName ?? id;
  }
  function getLocationName(id: string | undefined): string {
    if (!id) return '—';
    return allLocations.find((l) => l.id === id)?.name ?? id;
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-swan-200 border-t-swan-500" />
          <p className="text-sm">Đang tải hồ sơ CASE...</p>
        </div>
      </div>
    );
  }

  if (notFound || !caseRecord) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-gray-400">
        <AlertCircle className="h-12 w-12 opacity-30" />
        <div className="text-center">
          <p className="text-base font-medium">Không tìm thấy hồ sơ</p>
          <p className="mt-1 text-sm">Hồ sơ này có thể đã bị xóa hoặc không tồn tại</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/cases')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const allowedTransitions = CASE_STATUS_TRANSITIONS[caseRecord.status] ?? [];
  const privacyCfg = PRIVACY_CONFIG[caseRecord.privacyLevel];
  const activeServices = caseServices.filter((s) => s.active !== false);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/cases" className="flex items-center gap-1 hover:text-swan-600 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Hồ sơ CASE
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-900">{caseRecord.caseCode}</span>
      </nav>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-swan-100 text-swan-600">
              <Briefcase className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-swan-50 px-2 py-0.5 text-xs font-mono font-semibold text-swan-700 border border-swan-200">
                  {caseRecord.caseCode}
                </span>
                <CaseStatusBadge status={caseRecord.status} />
                <Badge variant={caseRecord.priority === 'urgent' ? 'danger' : caseRecord.priority === 'high' ? 'warning' : 'default'}>
                  {PRIORITY_LABELS[caseRecord.priority] ?? caseRecord.priority}
                </Badge>
                {privacyCfg && <Badge variant={privacyCfg.variant}>{privacyCfg.label}</Badge>}
              </div>
              {customer && (
                <Link href={`/customers/${customer.id}`} className="mt-2 flex items-center gap-2 text-sm text-gray-600 hover:text-swan-600 transition-colors">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{customer.fullName}</span>
                  <span className="text-gray-400">{formatPhone(customer.phone)}</span>
                </Link>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <Badge variant="default">{SERVICE_CATEGORY_LABELS[caseRecord.mainServiceGroup] ?? caseRecord.mainServiceGroup}</Badge>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateVN(caseRecord.caseDate)}
                </span>
              </div>
            </div>
          </div>
          {canWrite && (
            <Button variant="outline" size="sm" leftIcon={<Edit2 className="h-4 w-4" />} onClick={() => setEditOpen(true)}>
              Chỉnh sửa
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-all',
              activeTab === tab.id ? 'bg-swan-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'info' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-swan-600">Thông tin CASE</h3>
            <InfoRow label="Mã CA" value={caseRecord.caseCode} icon={<Briefcase className="h-4 w-4" />} />
            <InfoRow label="Ngày tạo" value={formatDateVN(caseRecord.caseDate)} icon={<Calendar className="h-4 w-4" />} />
            <InfoRow label="Trạng thái" value={<CaseStatusBadge status={caseRecord.status} size="sm" />} />
            <InfoRow label="Ưu tiên" value={PRIORITY_LABELS[caseRecord.priority] ?? caseRecord.priority} />
            <InfoRow label="Nhóm dịch vụ" value={SERVICE_CATEGORY_LABELS[caseRecord.mainServiceGroup]} />
            <InfoRow label="Điều trị tại" value={getLocationName(caseRecord.treatmentLocationId)} />
            <InfoRow label="Ngày lab dự kiến" value={formatDateVN(caseRecord.expectedLabDate)} />
            <InfoRow label="Ngày PT dự kiến" value={formatDateVN(caseRecord.expectedProcedureDate)} />
            <InfoRow label="Bảo mật" value={privacyCfg?.label} />
          </Card>
          <Card>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-swan-600">Tổng quan bill</h3>
            <BillSummary caseRecord={caseRecord} />
          </Card>
          <Card className="lg:col-span-2">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-swan-600">Ghi chú</h3>
            <InfoRow label="Ghi chú bán hàng" value={caseRecord.salesNote ? <p className="whitespace-pre-wrap text-sm">{caseRecord.salesNote}</p> : null} icon={<FileText className="h-4 w-4" />} />
            {canViewMedical && (
              <InfoRow label="Ghi chú y tế" value={caseRecord.medicalNote ? <p className="whitespace-pre-wrap text-sm">{caseRecord.medicalNote}</p> : null} icon={<FileText className="h-4 w-4" />} />
            )}
            <InfoRow label="Ghi chú nội bộ" value={caseRecord.internalNote ? <p className="whitespace-pre-wrap text-sm">{caseRecord.internalNote}</p> : null} icon={<FileText className="h-4 w-4" />} />
          </Card>
          {canStatusChange && allowedTransitions.length > 0 && (
            <Card className="lg:col-span-2">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-swan-600">Chuyển trạng thái</h3>
              <StatusWorkflow
                currentStatus={caseRecord.status}
                onTransition={async (newStatus) => {
                  await updateCaseStatus(caseId, newStatus, user?.id ?? 'dev-user');
                  await writeAuditLog({
                    actorId: user?.id ?? 'dev-user', actorName: user?.displayName ?? 'Dev',
                    actorRole: user?.role ?? 'admin', action: 'case_status_changed',
                    entityType: 'case', entityId: caseId,
                    before: { status: caseRecord.status }, after: { status: newStatus },
                  });
                  // Auto-create tasks based on status transition
                  try {
                    const { triggerAutoTasks } = await import('@/lib/tasks/auto-tasks');
                    await triggerAutoTasks(caseRecord, newStatus, user?.id ?? 'dev-user');
                  } catch (err) {
                    console.error('[CaseDetail] Auto-tasks trigger failed:', err);
                  }
                  // Auto-create post-op followups when case moves to procedure_completed
                  if (newStatus === 'procedure_completed') {
                    try {
                      const { createPostOpFollowups } = await import('@/lib/firestore/followups');
                      const procedureDate = caseRecord.actualProcedureDate
                        ? new Date(caseRecord.actualProcedureDate)
                        : new Date();
                      await createPostOpFollowups(
                        caseId,
                        caseRecord.customerId,
                        procedureDate,
                        user?.id ?? 'dev-user',
                      );
                    } catch (err) {
                      console.error('[CaseDetail] Create post-op followups failed:', err);
                    }
                  }
                  reload();
                }}
                loading={statusChanging}
              />
            </Card>
          )}

          <Card className="lg:col-span-2">
            <ChecklistPanel caseId={caseId} type="pre_hospital" />
          </Card>
          <Card className="lg:col-span-2">
            <ChecklistPanel caseId={caseId} type="pre_procedure" />
          </Card>
        </div>
      )}

      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Dịch vụ ({activeServices.length})</h3>
            {canWrite && (
              <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setServiceModalOpen(true)}>
                Thêm dịch vụ
              </Button>
            )}
          </div>
          {activeServices.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Briefcase className="mb-3 h-10 w-10 opacity-30" />
              <p className="font-medium">Chưa có dịch vụ</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeServices.map((s) => (
                <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">{s.serviceName}</span>
                        <Badge variant="default">{SERVICE_CATEGORY_LABELS[s.serviceCategory]}</Badge>
                        {s.isMainService && <Badge variant="info">Dịch vụ chính</Badge>}
                        {s.isGift && <Badge variant="success">Tặng</Badge>}
                        {s.isUpsell && <Badge variant="warning">Upsell</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span>SL: {s.quantity}</span>
                        <span>Giá niêm yết: {formatCurrency(s.listedPrice)}</span>
                        <span className="font-medium text-swan-700">Giá cuối: {formatCurrency(s.finalPrice)}</span>
                      </div>
                      {s.note && <p className="mt-1 text-xs text-gray-400">{s.note}</p>}
                    </div>
                    {canWrite && (
                      <button onClick={() => handleRemoveService(s.id)} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Thanh toán</h3>
            {canPaymentCreate && (
              <Button size="sm" leftIcon={<DollarSign className="h-4 w-4" />} onClick={() => setPaymentOpen(true)}>
                Tạo thanh toán
              </Button>
            )}
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <PaymentList caseId={caseId} refresh={refreshKey} />
          </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Phân công nhân sự</h3>
            {canWrite && (
              <Button size="sm" leftIcon={<Edit2 className="h-4 w-4" />} onClick={() => setStaffEditOpen(true)}>
                Chỉnh sửa
              </Button>
            )}
          </div>
          <Card>
            {STAFF_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-gray-600">{f.label}</span>
                {f.multi ? (
                  <div className="flex flex-wrap gap-1">
                    {((staffAssignment?.[f.field] as string[] | undefined) ?? []).length > 0
                      ? ((staffAssignment?.[f.field] as string[] | undefined) ?? []).map((id) => (
                          <Badge key={id} variant="default">{getUserName(id)}</Badge>
                        ))
                      : <span className="text-sm text-gray-400">Chưa phân công</span>
                    }
                  </div>
                ) : (
                  <span className={cn(
                    'text-sm',
                    (staffAssignment?.[f.field] as string | undefined) ? 'text-gray-900 font-medium' : 'text-gray-400',
                  )}>
                    {getUserName(staffAssignment?.[f.field] as string | undefined)}
                  </span>
                )}
              </div>
            ))}
          </Card>
        </div>
      )}

      {activeTab === 'timeline' && (
        <Card className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Clock className="mb-3 h-10 w-10 opacity-30" />
          <p className="font-medium">Timeline đang phát triển</p>
          <p className="mt-1 text-sm">Tính năng này sẽ sớm ra mắt</p>
        </Card>
      )}

      {activeTab === 'attachments' && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-gray-500" />
              <h2 className="text-lg font-semibold text-gray-900">File đính kèm</h2>
            </div>
            {canWrite && (
              <Button
                size="sm"
                leftIcon={<UploadIcon className="h-4 w-4" />}
                onClick={() => setAttachmentUploadOpen(true)}
              >
                Tải lên file
              </Button>
            )}
          </div>
          <AttachmentList
            caseId={caseId}
            customerId={caseRecord.customerId}
            canWrite={canWrite}
            canChangeVisibility={canWrite}
            refreshKey={refreshKey}
          />
        </Card>
      )}

      {activeTab === 'consents' && (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Quản lý Consent</h2>
          </div>
          <ConsentPanel
            customerId={caseRecord.customerId}
            caseId={caseId}
            canWrite={canWrite}
            refreshKey={refreshKey}
          />
        </Card>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Chỉnh sửa hồ sơ CASE" description={`Cập nhật ${caseRecord.caseCode}`} size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Ưu tiên" name="priority" defaultValue={caseRecord.priority}>
              <option value="normal">Bình thường</option>
              <option value="high">Cao</option>
              <option value="urgent">Khẩn cấp</option>
            </Select>
            <Select label="Bảo mật" name="privacyLevel" defaultValue={caseRecord.privacyLevel}>
              <option value="normal">Bình thường</option>
              <option value="vip">VIP</option>
              <option value="highly_sensitive">Nhạy cảm cao</option>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Ngày lab dự kiến" type="date" name="expectedLabDate" defaultValue={caseRecord.expectedLabDate ?? ''} />
            <Input label="Ngày PT dự kiến" type="date" name="expectedProcedureDate" defaultValue={caseRecord.expectedProcedureDate ?? ''} />
          </div>
          <Input label="Ghi chú bán hàng" name="salesNote" defaultValue={caseRecord.salesNote ?? ''} placeholder="Ghi chú bán hàng..." />
          {canViewMedical && <Input label="Ghi chú y tế" name="medicalNote" defaultValue={caseRecord.medicalNote ?? ''} placeholder="Ghi chú y tế..." />}
          <Input label="Ghi chú nội bộ" name="internalNote" defaultValue={caseRecord.internalNote ?? ''} placeholder="Ghi chú nội bộ..." />
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editLoading}>Hủy</Button>
            <Button type="submit" isLoading={editLoading}>Lưu thay đổi</Button>
          </div>
        </form>
      </Modal>

      <Modal open={serviceModalOpen} onClose={() => { setServiceModalOpen(false); setServiceError(null); resetServiceForm(); }} title="Thêm dịch vụ" size="lg">
        {serviceError && <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{serviceError}</div>}
        <form onSubmit={handleSubmitService(onAddService)} className="space-y-4 p-6">
          <Input label="Tên dịch vụ *" error={serviceErrors.serviceName?.message} {...regService('serviceName')} placeholder="Nhập tên dịch vụ..." />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Nhóm *" error={serviceErrors.serviceCategory?.message} {...regService('serviceCategory')}>
              <option value="nose">Mũi</option>
              <option value="breast">Ngực</option>
              <option value="body">Body</option>
              <option value="eyes">Mắt</option>
              <option value="skin">Da</option>
              <option value="injectable">Tiêm</option>
              <option value="other">Khác</option>
            </Select>
            <Input label="Số lượng" type="number" min={1} error={serviceErrors.quantity?.message} {...regService('quantity', { valueAsNumber: true })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Giá niêm yết" type="number" min={0} step={1000} error={serviceErrors.listedPrice?.message} {...regService('listedPrice', { valueAsNumber: true })} />
            <Input label="Giá cuối" type="number" min={0} step={1000} error={serviceErrors.finalPrice?.message} {...regService('finalPrice', { valueAsNumber: true })} />
          </div>
          <Input label="Ghi chú" error={serviceErrors.note?.message} {...regService('note')} placeholder="Ghi chú..." />
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={() => { setServiceModalOpen(false); resetServiceForm(); }} disabled={serviceSubmitting}>Hủy</Button>
            <Button type="submit" isLoading={serviceSubmitting}>Thêm</Button>
          </div>
        </form>
      </Modal>

      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Tạo thanh toán" size="lg">
        <PaymentForm
          caseId={caseId}
          customerId={caseRecord.customerId}
          onSubmit={async (data: CreatePaymentFormValues) => {
            try {
              await createPayment(data, user?.id ?? 'dev-user');
              await writeAuditLog({
                actorId: user?.id ?? 'dev-user', actorName: user?.displayName ?? 'Dev',
                actorRole: user?.role ?? 'admin', action: 'payment_created',
                entityType: 'payment', entityId: caseId,
                after: data as unknown as Record<string, unknown>,
              });
              reload();
              setPaymentOpen(false);
            } catch (err) {
              console.error('[CaseDetail] Create payment error:', err);
            }
          }}
          onClose={() => setPaymentOpen(false)}
        />
      </Modal>

      <Modal open={staffEditOpen} onClose={() => setStaffEditOpen(false)} title="Chỉnh sửa phân công" size="lg">
        <StaffAssignmentForm
          staff={staffAssignment}
          allUsers={allUsers}
          saving={staffSaving}
          onSave={handleStaffSave}
          onCancel={() => setStaffEditOpen(false)}
        />
      </Modal>

      <AttachmentUploadDialog
        caseId={caseId}
        customerId={caseRecord.customerId}
        open={attachmentUploadOpen}
        onClose={() => setAttachmentUploadOpen(false)}
        onUploaded={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}

// ─── Staff form (inline) ─────────────────────────────────────────────────

function StaffAssignmentForm({
  staff, allUsers, saving, onSave, onCancel,
}: {
  staff: StaffAssignment | null;
  allUsers: UserType[];
  saving: boolean;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const f of STAFF_FIELDS) {
      const val = staff?.[f.field];
      initial[f.key] = f.multi ? ((val as string[]) ?? []) : ((val as string) ?? '');
    }
    return initial;
  });

  function handleChange(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value || '' }));
  }
  function handleMultiToggle(key: string, userId: string) {
    setFormData((prev) => {
      const arr = (prev[key] as string[]) ?? [];
      const next = arr.includes(userId) ? arr.filter((id) => id !== userId) : [...arr, userId];
      return { ...prev, [key]: next };
    });
  }

  return (
    <div className="space-y-4 p-6">
      {STAFF_FIELDS.map((f) => {
        const users = allUsers.filter((u) => f.allowedRoles.includes(u.role) && u.isActive);
        if (f.multi) {
          const selected = (formData[f.key] as string[]) ?? [];
          return (
            <div key={f.key}>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{f.label}</label>
              <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                  <button
                    key={u.id} type="button"
                    onClick={() => handleMultiToggle(f.key, u.id)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-sm transition-all',
                      selected.includes(u.id) ? 'border-swan-500 bg-swan-50 text-swan-700' : 'border-gray-200 text-gray-600 hover:border-gray-300',
                    )}
                  >
                    {u.displayName}
                  </button>
                ))}
                {users.length === 0 && <span className="text-sm text-gray-400">Không có nhân sự phù hợp</span>}
              </div>
            </div>
          );
        }
        return (
          <div key={f.key}>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{f.label}</label>
            <Select value={(formData[f.key] as string) ?? ''} onChange={(e) => handleChange(f.key, e.target.value)}>
              <option value="">— Chưa phân công —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </Select>
          </div>
        );
      })}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <Button variant="outline" onClick={onCancel} disabled={saving}>Hủy</Button>
        <Button isLoading={saving} onClick={() => onSave(formData)}>Lưu phân công</Button>
      </div>
    </div>
  );
}