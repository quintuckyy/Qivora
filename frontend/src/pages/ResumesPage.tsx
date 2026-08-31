import { useRef, useState } from 'react';
import { useAsync } from '../hooks/useAsync';
import { resumesApi } from '../api/resumes';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Resume } from '../api/types';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { PlusIcon } from '../components/icons';
import { ResumeCard } from '../components/resumes/ResumeCard';
import { ResumePreviewModal } from '../components/resumes/ResumePreviewModal';
import { RenameResumeModal } from '../components/resumes/RenameResumeModal';
import { ResumesEmptyState } from '../components/resumes/ResumesEmptyState';

const ACCEPT = '.pdf,.doc,.docx';
const MAX_SIZE = 5 * 1024 * 1024;

export function ResumesPage() {
  const { token } = useAuth();
  const { status, data: resumes, error, refetch } = useAsync(() => resumesApi.list(), []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [previewResume, setPreviewResume] = useState<Resume | null>(null);
  const [renameResume, setRenameResume] = useState<Resume | null>(null);

  function pickFile() {
    setUploadError(null);
    fileInputRef.current?.click();
  }

  async function handleFileChange() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE) {
      setUploadError('That file is larger than 5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      await resumesApi.upload(file);
      refetch();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : 'Unable to upload resume.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload(resume: Resume) {
    setActionError(null);
    setDownloadingId(resume.id);
    try {
      await resumesApi.download(resume, token);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to download resume.');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleSetDefault(resume: Resume) {
    setActionError(null);
    setSettingDefaultId(resume.id);
    try {
      await resumesApi.setDefault(resume.id);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to set default resume.');
    } finally {
      setSettingDefaultId(null);
    }
  }

  async function handleDelete(resume: Resume) {
    const extra = resume.applicationCount
      ? ` It's assigned to ${resume.applicationCount} application${
          resume.applicationCount === 1 ? '' : 's'
        }, which will be left without a resume.`
      : '';
    if (!confirm(`Delete "${resume.name}"?${extra}`)) return;

    setActionError(null);
    try {
      await resumesApi.remove(resume.id);
      refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to delete resume.');
    }
  }

  const uploadButton = (
    <button type="button" className="btn btn-primary" onClick={pickFile} disabled={uploading}>
      <PlusIcon />
      {uploading ? 'Uploading…' : 'Upload resume'}
    </button>
  );

  return (
    <div className="page">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFileChange}
        className="sr-only"
        tabIndex={-1}
      />

      <div className="page-header">
        <div className="page-heading">
          <h1>Resumes</h1>
          <p className="page-subtitle">
            Keep your tailored resume versions in one place and track how each performs.
          </p>
        </div>
        {status === 'success' && resumes.length > 0 && (
          <div className="page-header-actions">{uploadButton}</div>
        )}
      </div>

      {uploadError && (
        <p className="form-error" role="alert">
          {uploadError}
        </p>
      )}
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      {status === 'loading' && <LoadingState label="Loading resumes…" />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}

      {status === 'success' &&
        (resumes.length === 0 ? (
          <ResumesEmptyState uploadAction={uploadButton} />
        ) : (
          <div className="resume-grid">
            {resumes.map((resume) => (
              <ResumeCard
                key={resume.id}
                resume={resume}
                downloading={downloadingId === resume.id}
                settingDefault={settingDefaultId === resume.id}
                onPreview={() => setPreviewResume(resume)}
                onDownload={() => handleDownload(resume)}
                onRename={() => setRenameResume(resume)}
                onSetDefault={() => handleSetDefault(resume)}
                onDelete={() => handleDelete(resume)}
              />
            ))}
          </div>
        ))}

      {previewResume && (
        <ResumePreviewModal
          resume={previewResume}
          onClose={() => setPreviewResume(null)}
          onDownload={() => {
            handleDownload(previewResume);
            setPreviewResume(null);
          }}
        />
      )}

      {renameResume && (
        <RenameResumeModal
          resume={renameResume}
          onClose={() => setRenameResume(null)}
          onRenamed={() => {
            setRenameResume(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
