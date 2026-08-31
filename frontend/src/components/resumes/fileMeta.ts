/** Shared formatting for resume file metadata shown on the cards. */

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

export function fileTypeLabel(mimeType: string, originalName: string): string {
  if (MIME_LABELS[mimeType]) return MIME_LABELS[mimeType];
  const ext = originalName.split('.').pop();
  return ext ? ext.toUpperCase() : 'File';
}

export function isPreviewable(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
