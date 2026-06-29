'use client';

import { useCallback, useEffect, useState } from 'react';
import { Attachment, AttachmentVisibility } from '@/lib/types';
import { getAttachmentsByCase, updateAttachmentVisibility } from '@/lib/firestore/attachments';
import { ATTACHMENT_TYPE_LABELS, ATTACHMENT_VISIBILITY_LABELS, ATTACHMENT_VISIBILITIES } from '@/lib/validators/attachment';
import { writeAuditLog } from '@/lib/firestore/audit';
import { useToast } from '@/components/ui/toast';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { formatDateVN } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import {
  FileText, FileImage, File, MoreVertical, Trash2,
  Shield, Eye, EyeOff, Loader2, Download,
} from 'lucide-react';

interface AttachmentListProps {
  caseId: string;
  canWrite: boolean;
  canChangeVisibility: boolean;
  refreshKey?: number;
}

const VISIBILITY_BADGE: Record<AttachmentVisibility, string> = {
  private: 'bg-gray-100 text-gray-700 border-gray-200',
  medical_team: 'bg-rose-100 text-rose-700 border-rose-200',
  sales_team: 'bg-sky-100 text-sky-700 border-sky-200',
  media_approved: 'bg-amber-100 text-amber-700 border-amber-200',
  public_marketing: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType === 'application/pdf') return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({
  caseId,
  canWrite,
  canChangeVisibility,
  refreshKey = 0,
}: AttachmentListProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAttachmentsByCase(caseId);
      const sorted = [...data].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setAttachments(sorted);
    } catch (err) {
      console.error('Load attachments error:', err);
      toast('Không thể tải danh sách file đính kèm', 'error');
    } finally {
      setLoading(false);
    }
  }, [caseId, toast]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function handleVisibilityChange(id: string, visibility: AttachmentVisibility) {
    try {
      await updateAttachmentVisibility(id, visibility, user?.id ?? 'dev-user');
      await writeAuditLog({
        actorId: user?.id ?? 'dev-user',
        actorName: user?.displayName ?? 'Dev User',
        actorRole: user?.role ?? 'admin',
        action: 'attachment_visibility_changed',
        entityType: 'attachment',
        entityId: id,
        after: { visibility },
      });
      toast('Đã cập nhật quyền xem file', 'success');
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      toast('Không thể cập nhật: ' + msg, 'error');
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      setDeleting(true);
      // Use API route — it handles deletion + audit log internally
      const res = await fetch(`/api/attachments/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast('Đã xóa file đính kèm', 'success');
      setDeleteId(null);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown';
      toast('Không thể xóa: ' + msg, 'error');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (attachments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <FileImage className="mx-auto h-10 w-10 text-gray-300" />
        <p className="mt-3 text-sm text-gray-500">
          Chưa có file đính kèm nào cho ca này
        </p>
        {canWrite && (
          <p className="mt-1 text-xs text-gray-400">
            Bấm nút Tải lên file ở trên để thêm file mới
          </p>
        )}
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {attachments.map((att) => {
          const Icon = fileIcon(att.mimeType);
          const isImage = att.mimeType.startsWith('image/');

          return (
            <Card
              key={att.id}
              className="group flex items-center gap-4 p-4 transition-all hover:shadow-medium"
            >
              {/* Thumbnail / icon */}
              <div
                className={cn(
                  'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl',
                  isImage
                    ? 'bg-gradient-to-br from-swan-100 to-swan-50'
                    : 'bg-gradient-to-br from-gray-100 to-gray-50',
                )}
              >
                {isImage && att.fileUrl && att.fileUrl.startsWith('data:') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={att.fileUrl}
                    alt={att.fileName}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      isImage ? 'text-swan-600' : 'text-gray-500',
                    )}
                  />
                )}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {att.fileName}
                  </p>
                  {att.consentRequired && (
                    <Shield className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">
                    {ATTACHMENT_TYPE_LABELS[att.type]}
                  </span>
                  <span>{formatFileSize(att.size)}</span>
                  <span>•</span>
                  <span>{formatDateVN(att.createdAt)}</span>
                </div>
                <div className="mt-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                      VISIBILITY_BADGE[att.visibility],
                    )}
                  >
                    <Eye className="h-3 w-3" />
                    {ATTACHMENT_VISIBILITY_LABELS[att.visibility]}
                  </span>
                </div>
                {att.note && (
                  <p className="mt-2 line-clamp-1 text-xs text-gray-500">
                    {att.note}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {att.fileUrl && (
                  <a
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    title="Tải xuống"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                )}

                {(canChangeVisibility || canWrite) && (
                  <DropdownMenu
                    trigger={
                      <button
                        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                        aria-label="Thao tác"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    }
                    items={[
                      ...(canChangeVisibility
                        ? ATTACHMENT_VISIBILITIES.filter((v) => v !== att.visibility).map((v) => ({
                            label: `Đổi thành: ${ATTACHMENT_VISIBILITY_LABELS[v as AttachmentVisibility]}`,
                            icon: <EyeOff className="h-4 w-4" />,
                            onClick: () => { void handleVisibilityChange(att.id, v); },
                          }))
                        : []),
                      ...(canWrite
                        ? [{
                            label: 'Xóa file',
                            icon: <Trash2 className="h-4 w-4" />,
                            variant: 'danger' as const,
                            onClick: () => setDeleteId(att.id),
                          }]
                        : []),
                    ]}
                  />
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Xóa file đính kèm?"
        description="Hành động này không thể hoàn tác. File sẽ bị xóa vĩnh viễn."
        confirmLabel="Xóa file"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}