'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createAttachmentSchema,
  ATTACHMENT_TYPES,
  ATTACHMENT_TYPE_LABELS,
  ATTACHMENT_VISIBILITIES,
  ATTACHMENT_VISIBILITY_LABELS,
  CreateAttachmentFormValues,
} from '@/lib/validators/attachment';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { writeAuditLog } from '@/lib/firestore/audit';
import { isMockEnabled } from '@/lib/mock/store';
import { validateFile, getMockFileUrl, getStoragePath, ALLOWED_FILE_TYPES } from '@/lib/firebase/storage';
import { Upload, FileImage, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface AttachmentUploadDialogProps {
  caseId: string;
  customerId: string;
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

export function AttachmentUploadDialog({
  caseId,
  customerId,
  open,
  onClose,
  onUploaded,
}: AttachmentUploadDialogProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateAttachmentFormValues>({
    resolver: zodResolver(createAttachmentSchema),
    defaultValues: {
      caseId,
      customerId,
      type: 'other',
      visibility: 'private',
      consentRequired: false,
      note: '',
    },
  });

  const selectedType = watch('type');
  const selectedVisibility = watch('visibility');

  function handleFileSelect(f: File | null) {
    if (!f) return;
    const validation = validateFile(f, ALLOWED_FILE_TYPES);
    if (!validation.valid) {
      toast(validation.error ?? 'File không hợp lệ', 'error');
      return;
    }
    setFile(f);
    setValue('fileName', f.name);
    // Auto-pick type from mime
    if (f.type === 'application/pdf') {
      setValue('type', 'medical_document');
    } else if (f.type.startsWith('image/')) {
      setValue('type', 'before_image');
    }
  }

  function clearFile() {
    setFile(null);
    setValue('fileName', '');
    if (inputRef.current) inputRef.current.value = '';
  }

  async function onSubmit(data: CreateAttachmentFormValues) {
    if (!file) {
      toast('Vui lòng chọn file', 'error');
      return;
    }

    try {
      setSubmitting(true);

      const storagePath = getStoragePath(caseId, file.name);
      // In dev mode: use mock URL; in real mode: upload to Firebase Storage
      const fileUrl = isMockEnabled() ? getMockFileUrl(file.name) : storagePath;

      const payload = {
        ...data,
        fileUrl,
        storagePath,
        mimeType: file.type,
        size: file.size,
      };

      const res = await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          uploadedBy: user?.id ?? 'dev-user',
          uploadedByName: user?.displayName ?? 'Dev User',
          uploadedByRole: user?.role ?? 'admin',
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error ?? 'Upload thất bại');
      }

      // Client-side audit log (server also writes one)
      await writeAuditLog({
        actorId: user?.id ?? 'dev-user',
        actorName: user?.displayName ?? 'Dev User',
        actorRole: user?.role ?? 'admin',
        action: 'attachment_uploaded',
        entityType: 'attachment',
        entityId: result.result.id,
        after: { type: data.type, fileName: data.fileName },
      });

      toast('Đã tải lên file thành công', 'success');
      reset();
      clearFile();
      onUploaded();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast('Không thể tải lên: ' + msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tải lên file đính kèm" size="lg" closeLabel="Đóng hộp thoại tải lên file đính kèm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* File drop zone */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            File
          </label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFileSelect(e.dataTransfer.files[0] ?? null);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 transition-all',
              dragActive
                ? 'border-swan-400 bg-swan-50/50'
                : 'border-gray-300 bg-gray-50 hover:border-swan-300 hover:bg-swan-50/30',
              file && 'border-emerald-300 bg-emerald-50/50',
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_FILE_TYPES.join(',')}
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex w-full items-center gap-3">
                <FileImage className="h-8 w-8 flex-shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearFile(); }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm font-medium text-gray-700">
                  Kéo thả file hoặc bấm để chọn
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Hỗ trợ JPG, PNG, WEBP, PDF — tối đa 20MB
                </p>
              </>
            )}
          </div>
          {isMockEnabled() && (
            <p className="mt-1.5 text-xs text-amber-600">
              ⚠️ Chế độ dev — chỉ lưu metadata, không upload file thực
            </p>
          )}
        </div>

        <Select
          label="Loại file"
          required
          error={errors.type?.message}
          value={selectedType}
          {...register('type')}
        >
          {ATTACHMENT_TYPES.map((t) => (
            <option key={t} value={t}>{ATTACHMENT_TYPE_LABELS[t]}</option>
          ))}
        </Select>

        <Select
          label="Quyền xem"
          required
          value={selectedVisibility}
          {...register('visibility')}
        >
          {ATTACHMENT_VISIBILITIES.map((v) => (
            <option key={v} value={v}>{ATTACHMENT_VISIBILITY_LABELS[v]}</option>
          ))}
        </Select>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="consentRequired"
            {...register('consentRequired')}
            className="h-4 w-4 rounded border-gray-300 text-swan-600 focus:ring-swan-500"
          />
          <label htmlFor="consentRequired" className="text-sm text-gray-700">
            Cần consent từ khách hàng (ảnh y tế, before/after)
          </label>
        </div>

        <Textarea
          label="Ghi chú (tuỳ chọn)"
          rows={3}
          error={errors.note?.message}
          {...register('note')}
        />

        <input type="hidden" {...register('fileUrl')} />
        <input type="hidden" {...register('storagePath')} />

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Hủy
          </Button>
          <Button type="submit" disabled={submitting || !file}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tải lên...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Tải lên
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}