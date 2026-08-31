import { useEffect, useState } from 'react';
import { resumesApi } from '../../api/resumes';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { Resume } from '../../api/types';
import { Modal } from '../Modal';
import { DownloadIcon, FileIcon } from '../icons';
import { fileTypeLabel, isPreviewable } from './fileMeta';

/**
 * In-app preview for a resume. PDFs render in an <iframe> from a blob URL (the
 * preview endpoint needs a bearer token, so a direct src won't work); DOC/DOCX
 * can't be shown inline, so they fall back to a download prompt.
 */
export function ResumePreviewModal({
  resume,
  onClose,
  onDownload,
}: {
  resume: Resume;
  onClose: () => void;
  onDownload: () => void;
}) {
  const { token } = useAuth();
  const previewable = isPreviewable(resume.mimeType);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewable) return;

    let revoked: string | null = null;
    let cancelled = false;

    resumesApi
      .previewObjectUrl(resume.id, token)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoked = url;
        setObjectUrl(url);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Unable to load preview.');
        }
      });

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [resume.id, token, previewable]);

  return (
    <Modal title={resume.name} onClose={onClose} size="wide">
      <div className="resume-preview">
        {!previewable ? (
          <div className="resume-preview-fallback">
            <span className="resume-preview-fallback-icon">
              <FileIcon />
            </span>
            <p className="resume-preview-fallback-title">
              {fileTypeLabel(resume.mimeType, resume.originalName)} files can't be previewed in the
              browser
            </p>
            <p className="muted">Download the file to open it in your document editor.</p>
            <button type="button" className="btn btn-primary" onClick={onDownload}>
              <DownloadIcon />
              Download {resume.originalName}
            </button>
          </div>
        ) : error ? (
          <div className="resume-preview-fallback">
            <p className="form-error" role="alert">
              {error}
            </p>
            <button type="button" className="btn btn-secondary" onClick={onDownload}>
              <DownloadIcon />
              Download instead
            </button>
          </div>
        ) : objectUrl ? (
          <iframe className="resume-preview-frame" src={objectUrl} title={`Preview of ${resume.name}`} />
        ) : (
          <div className="resume-preview-fallback">
            <div className="spinner" />
            <p className="muted">Loading preview…</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
