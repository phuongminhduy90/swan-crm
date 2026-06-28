'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Image as ImageIcon, Loader2, Grid3X3, List, Upload,
  FileImage, FileText, File as FileIcon,
} from 'lucide-react';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { useToast } from '@/components/ui/toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { SearchInput } from '@/components/ui/search-input';
import { Badge } from '@/components/ui/badge';
import { Attachment, AttachmentType, AttachmentVisibility } from '@/lib/types';
import { ATTACHMENT_TYPE_LABELS, ATTACHMENT_VISIBILITY_LABELS } from '@/lib/validators/attachment';
import { AttachmentUploadDialog } from '@/components/attachments';
import { cn } from '@/lib/utils/cn';
import { formatDateTimeVN } from '@/lib/utils/format';

const VISIBILITY_BADGE: Record<AttachmentVisibility, string> = {
  private: 'bg-gray-100 text-gray-700',
  medical_team: 'bg-rose-100 text-rose-700',
  sales_team: 'bg-sky-100 text-sky-700',
  media_approved: 'bg-amber-100 text-amber-700',
  public_marketing: 'bg-emerald-100 text-emerald-700',
};

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType === 'application/pdf') return FileText;
  return FileIcon;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterVisibility, setFilterVisibility] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploadOpen, setUploadOpen] = useState(false);
  // For upload: need to pick a case — just use case-001 by default in dev
  const [uploadCaseId] = useState('case-001');
  const [uploadCustomerId] = useState('cus-001');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/attachments');
      const data = await res.json();
      if (data.success) {
        setAttachments(data.attachments ?? []);
      }
    } catch (err) {
      console.error('Load attachments error:', err);
      toast('Không thể tải thư viện media', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = attachments.filter((a) => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterVisibility !== 'all' && a.visibility !== filterVisibility) return false;
    if (search && !a.fileName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-swan-500 to-swan-600 text-white shadow-glow-swan">
            <ImageIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Thư viện Media</h1>
            <p className="text-sm text-gray-500">{filtered.length} file</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? 'Danh sách' : 'Lưới'}
          </Button>
          <Button
            size="sm"
            leftIcon={<Upload className="h-4 w-4" />}
            onClick={() => setUploadOpen(true)}
          >
            Tải lên file
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Loại file"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Tất cả loại</option>
            {Object.entries(ATTACHMENT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select
            label="Quyền xem"
            value={filterVisibility}
            onChange={(e) => setFilterVisibility(e.target.value)}
          >
            <option value="all">Tất cả quyền</option>
            {Object.entries(ATTACHMENT_VISIBILITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Tìm file</label>
            <SearchInput value={search} onChange={setSearch} placeholder="Tên file..." />
          </div>
        </div>
      </Card>

      {/* Grid / List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-sm font-medium text-gray-900">Không tìm thấy file nào</p>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((att) => {
            const Icon = fileIcon(att.mimeType);
            const isImage = att.mimeType.startsWith('image/');
            return (
              <Card key={att.id} className="group overflow-hidden p-0 transition-all hover:shadow-medium">
                <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
                  {isImage && att.fileUrl?.startsWith('data:') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={att.fileUrl} alt={att.fileName} className="h-full w-full object-cover" />
                  ) : (
                    <Icon className="h-10 w-10 text-gray-400" />
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-medium text-gray-900">{att.fileName}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                      {ATTACHMENT_TYPE_LABELS[att.type as AttachmentType]}
                    </span>
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', VISIBILITY_BADGE[att.visibility])}>
                      {ATTACHMENT_VISIBILITY_LABELS[att.visibility]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatFileSize(att.size)} · {formatDateTimeVN(att.createdAt)}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-gray-100">
            {filtered.map((att) => {
              const Icon = fileIcon(att.mimeType);
              return (
                <div key={att.id} className="flex items-center gap-3 p-3 hover:bg-gray-50">
                  <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg', att.mimeType.startsWith('image/') ? 'bg-swan-50 text-swan-600' : 'bg-gray-100 text-gray-500')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{att.fileName}</p>
                    <div className="mt-0.5 flex gap-1.5 text-xs text-gray-500">
                      <span>{ATTACHMENT_TYPE_LABELS[att.type as AttachmentType]}</span>
                      <span>·</span>
                      <span>{formatFileSize(att.size)}</span>
                    </div>
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', VISIBILITY_BADGE[att.visibility])}>
                    {ATTACHMENT_VISIBILITY_LABELS[att.visibility]}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <AttachmentUploadDialog
        caseId={uploadCaseId}
        customerId={uploadCustomerId}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={load}
      />
    </div>
  );
}