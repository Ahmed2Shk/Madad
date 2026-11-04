// Document upload rules (SPEC §5 FileUpload, §7 A-05): PDF or image, up to 5MB per file.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_ACCEPT = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export function validateUpload(file: { type: string; size: number }): 'fileType' | 'fileSize' | null {
  if (!UPLOAD_ACCEPT.includes(file.type)) return 'fileType';
  if (file.size > MAX_UPLOAD_BYTES) return 'fileSize';
  return null;
}
