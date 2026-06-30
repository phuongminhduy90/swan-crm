'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FileText, ChevronDown, ChevronRight, Loader2, UserPlus, Edit,
  FolderPlus, ArrowRightLeft, DollarSign, Upload, Shield,
  Users, CheckCircle2, Trash2, AlertTriangle, FilePlus,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AuditAction, AuditEntityType, AuditLog } from '@/lib/types';
import { ROLE_LABELS } from '@/config/roles';
import { cn } from '@/lib/utils/cn';
import { formatDateTimeVN } from '@/lib/utils/format';
import { AUDIT_REDACTED_PLACEHOLDER } from '@/lib/firestore/audit';

/**
 * Story B.2.3 (F-MED-17) — Render the PII redaction placeholder in the
 * audit log diff. The placeholder is `[ĐÃ ẨN]` (Vietnamese for "[HIDDEN]"),
 * styled gray italic with a tooltip explaining why the value is hidden.
 */
const REDACTED_TOOLTIP = 'Thông tin nhạy cảm đã được ẩn vì lý do bảo mật';

/**
 * Recursively replace every value in `payload` that equals the redacted
 * placeholder with a JSX node so the JSON pretty-print shows the styled
 * placeholder instead of the raw string. Non-redacted values are left as
 * primitives (objects/arrays are stringified by JSON.stringify below).
 */
function renderRedactedJson(payload: Record<string, unknown>): React.ReactNode {
  const json = JSON.stringify(payload, null, 2);
  if (!json.includes(AUDIT_REDACTED_PLACEHOLDER)) {
    return json;
  }

  // Split the JSON string on placeholder occurrences so each can be
  // rendered with the styled redacted chip. The boundary tokens
  // (`"`, `,`, `:`, `}`, `]`, whitespace) ensure we match the placeholder
  // only when it is a complete JSON string value, not part of a larger
  // value.
  const escapedPlaceholder = AUDIT_REDACTED_PLACEHOLDER.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  const redactionRegex = new RegExp(
    `("${escapedPlaceholder}")|("[^"]*${escapedPlaceholder}[^"]*")`,
    'g',
  );

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = redactionRegex.exec(json)) !== null) {
    if (match.index > lastIndex) {
      parts.push(json.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={`redacted-${key++}`}
        className="italic text-gray-500"
        title={REDACTED_TOOLTIP}
      >
        {match[0]}
      </span>,
    );
    lastIndex = redactionRegex.lastIndex;
  }
  if (lastIndex < json.length) {
    parts.push(json.slice(lastIndex));
  }
  return parts;
}

const AUDIT_ACTION_LABELS: Record<AuditAction, { label: string; icon: React.ElementType; color: string }> = {
  customer_created: { label: 'Tạo khách hàng', icon: UserPlus, color: 'text-emerald-600 bg-emerald-50' },
  customer_updated: { label: 'Cập nhật khách hàng', icon: Edit, color: 'text-blue-600 bg-blue-50' },
  customer_deleted: { label: 'Xóa khách hàng', icon: Trash2, color: 'text-red-600 bg-red-50' },
  case_created: { label: 'Tạo ca', icon: FolderPlus, color: 'text-emerald-600 bg-emerald-50' },
  case_updated: { label: 'Cập nhật ca', icon: Edit, color: 'text-blue-600 bg-blue-50' },
  case_status_changed: { label: 'Đổi trạng thái ca', icon: ArrowRightLeft, color: 'text-amber-600 bg-amber-50' },
  payment_created: { label: 'Tạo thanh toán', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  payment_confirmed: { label: 'Xác nhận thanh toán', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  payment_rejected: { label: 'Từ chối thanh toán', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  attachment_uploaded: { label: 'Upload file', icon: Upload, color: 'text-swan-600 bg-swan-50' },
  attachment_deleted: { label: 'Xóa file đính kèm', icon: Trash2, color: 'text-red-600 bg-red-50' },
  attachment_visibility_changed: { label: 'Đổi quyền xem file', icon: Shield, color: 'text-purple-600 bg-purple-50' },
  consent_created: { label: 'Tạo consent', icon: Shield, color: 'text-teal-600 bg-teal-50' },
  consent_updated: { label: 'Cập nhật consent', icon: Shield, color: 'text-teal-600 bg-teal-50' },
  staff_assignment_changed: { label: 'Phân công nhân sự', icon: Users, color: 'text-indigo-600 bg-indigo-50' },
  task_completed: { label: 'Hoàn thành task', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
  followup_completed: { label: 'Hoàn thành follow-up', icon: CheckCircle2, color: 'text-teal-600 bg-teal-50' },
  followup_escalated: { label: 'Escalate follow-up', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  role_changed: { label: 'Đổi vai trò', icon: Users, color: 'text-purple-600 bg-purple-50' },
  note_added: { label: 'Thêm ghi chú', icon: FilePlus, color: 'text-gray-600 bg-gray-50' },
};

const ENTITY_TYPE_LABELS: Record<AuditEntityType | 'all', string> = {
  all: 'Tất cả',
  customer: 'Khách hàng',
  case: 'Ca',
  payment: 'Thanh toán',
  attachment: 'File đính kèm',
  consent: 'Consent',
  task: 'Công việc',
  followup: 'Follow-up',
  user: 'Người dùng',
};

export default function AuditLogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [entityType, setEntityType] = useState<string>('all');
  const [action, setAction] = useState<string>('all');
  const [actorSearch, setActorSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (entityType !== 'all') params.set('entityType', entityType);
      if (action !== 'all') params.set('action', action);
      if (actorSearch) params.set('actorSearch', actorSearch);

      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      console.error('Load audit logs error:', err);
      toast('Không thể tải nhật ký', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, entityType, action, actorSearch, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [entityType, action, actorSearch]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-swan-500 to-swan-600 text-white shadow-glow-swan">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhật ký hoạt động</h1>
          <p className="text-sm text-gray-500">
            {total} bản ghi · trang {page}/{totalPages}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Đối tượng"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            {Object.entries(ENTITY_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select
            label="Hành động"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="all">Tất cả</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Tìm theo người thực hiện
            </label>
            <SearchInput
              value={actorSearch}
              onChange={setActorSearch}
              placeholder="Tên hoặc vai trò..."
            />
          </div>
        </div>
      </Card>

      {/* Logs */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900">
            Không có nhật ký hoạt động nào
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-gray-100">
            {logs.map((log) => {
              const config = AUDIT_ACTION_LABELS[log.action];
              const Icon = config?.icon ?? FileText;
              const isExpanded = expandedId === log.id;
              const hasDetails = !!(log.before || log.after);

              return (
                <div key={log.id}>
                  <button
                    onClick={() => hasDetails && setExpandedId(isExpanded ? null : log.id)}
                    className={cn(
                      'flex w-full items-center gap-3 p-4 text-left transition-colors',
                      hasDetails && 'cursor-pointer hover:bg-gray-50',
                    )}
                  >
                    {hasDetails ? (
                      isExpanded ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      )
                    ) : (
                      <div className="w-4" />
                    )}

                    <div className={cn('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', config?.color)}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {config?.label ?? log.action}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {log.actorName}
                        <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                          {ROLE_LABELS[log.actorRole] ?? log.actorRole}
                        </span>
                        <span className="mx-1">·</span>
                        <Badge variant="default">
                          {ENTITY_TYPE_LABELS[log.entityType] ?? log.entityType}
                        </Badge>
                        <code className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700">
                          {log.entityId}
                        </code>
                      </p>
                    </div>

                    <div className="text-right text-xs text-gray-500">
                      {formatDateTimeVN(log.createdAt)}
                    </div>
                  </button>

                  {isExpanded && hasDetails && (
                    <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        {log.before && (
                          <div>
                            <p className="mb-1.5 text-xs font-semibold uppercase text-gray-500">Trước</p>
                            <pre className="overflow-x-auto rounded-lg bg-white p-3 text-xs text-gray-700 ring-1 ring-gray-200">
                              {renderRedactedJson(log.before)}
                            </pre>
                          </div>
                        )}
                        {log.after && (
                          <div>
                            <p className="mb-1.5 text-xs font-semibold uppercase text-gray-500">Sau</p>
                            <pre className="overflow-x-auto rounded-lg bg-white p-3 text-xs text-gray-700 ring-1 ring-gray-200">
                              {renderRedactedJson(log.after)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trước
          </Button>
          <span className="text-sm text-gray-600">
            Trang {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
  );
}