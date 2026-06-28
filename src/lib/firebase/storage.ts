import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage } from './client';
import { isMockEnabled } from '@/lib/mock/store';

// ── Constants ────────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_DOC_TYPES = ['application/pdf'];
export const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// ── Helpers ──────────────────────────────────────────────────

export async function uploadFile(
  path: string,
  file: File,
): Promise<string> {
  if (isMockEnabled()) return getMockFileUrl(file.name);
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function getFileUrl(path: string): Promise<string> {
  if (isMockEnabled()) return path;
  return getDownloadURL(ref(getFirebaseStorage(), path));
}

export async function deleteFile(path: string): Promise<void> {
  if (isMockEnabled()) return; // no-op in dev mode
  try {
    await deleteObject(ref(getFirebaseStorage(), path));
  } catch {
    console.warn('[storage] deleteFile failed, file may not exist:', path);
  }
}

export function validateFile(
  file: File,
  allowedTypes: string[] = ALLOWED_FILE_TYPES,
): { valid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Định dạng file không hỗ trợ (${file.type}). Chỉ chấp nhận ${allowedTypes.map((t) => t.split('/')[1]).join(', ')}`,
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Tối đa 20MB.`,
    };
  }
  return { valid: true };
}

/**
 * Returns a deterministic mock URL for dev mode.
 * Real upload is skipped — only metadata is stored.
 */
export function getMockFileUrl(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="160" viewBox="0 0 200 160">
        <rect fill="#f0f0f0" width="200" height="160" rx="8"/>
        <text x="100" y="80" font-size="12" fill="#999" text-anchor="middle" font-family="sans-serif">${fileName}</text>
      </svg>`,
    )}`;
  }
  return `/mock-storage/${encodeURIComponent(fileName)}`;
}

/**
 * Generates a deterministic storage path for new uploads.
 */
export function getStoragePath(caseId: string, fileName: string): string {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `cases/${caseId}/${Date.now()}-${safeFileName}`;
}