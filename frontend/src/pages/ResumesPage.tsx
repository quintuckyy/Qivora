import { useRef, useState } from 'react';
import { useAsync } from '../hooks/useAsync';
import { resumesApi } from '../api/resumes';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Resume } from '../api/types';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResumesPage() {
  const { token } = useAuth();
  const { status, data: resumes, error, refetch } = useAsync(() => resumesApi.list(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setUploadError('Choose a file first.');
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      await resumesApi.upload(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      refetch();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Unable to upload resume.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(resume: Resume) {
    setDownloadingId(resume.id);
    try {
      await resumesApi.download(resume, token);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to download resume.');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this resume?')) return;
    setDeletingId(id);
    try {
      await resumesApi.remove(id);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to delete resume.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Resumes</h1>
      </div>

      <section className="card">
        <h2>Upload a resume</h2>
        <p className="muted">PDF, DOC, or DOCX, up to 5 MB.</p>
        <div className="status-update-row">
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" />
          <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {uploadError && (
          <p className="form-error" role="alert">
            {uploadError}
          </p>
        )}
      </section>

      {status === 'loading' && <LoadingState label="Loading resumes…" />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}
      {status === 'success' &&
        (resumes.length === 0 ? (
          <EmptyState message="You haven't uploaded any resumes yet." />
        ) : (
          <ul className="entry-list">
            {resumes.map((resume) => (
              <li key={resume.id}>
                <div>
                  <strong>{resume.originalName}</strong>
                  <div className="muted">
                    {formatSize(resume.size)} · Uploaded {new Date(resume.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="entry-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleDownload(resume)}
                    disabled={downloadingId === resume.id}
                  >
                    {downloadingId === resume.id ? 'Downloading…' : 'Download'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDelete(resume.id)}
                    disabled={deletingId === resume.id}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
