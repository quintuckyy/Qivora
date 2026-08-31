import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi } from '../api/applications';
import { ApiError } from '../api/client';
import type { JobApplication } from '../api/types';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { StatusBadge } from '../components/StatusBadge';
import { ExternalLinkIcon } from '../components/icons';
import { ProgressSection } from '../components/application-detail/ProgressSection';
import { HistorySection } from '../components/application-detail/HistorySection';
import { ResumeAssignmentSection } from '../components/application-detail/ResumeAssignmentSection';
import { InterviewsSection } from '../components/application-detail/InterviewsSection';
import { NotesSection } from '../components/application-detail/NotesSection';

const SOURCE_LABELS: Record<string, string> = {
  LINKEDIN: 'LinkedIn',
  JOBSTREET: 'JobStreet',
  INDEED: 'Indeed',
  EMAIL_SYNC: 'Email Sync',
  MANUAL: 'Manual entry',
};

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    status: asyncStatus,
    data: application,
    error,
    refetch,
  } = useAsync(() => applicationsApi.get(id!), [id]);

  // Bumped whenever the status changes, so HistorySection knows to refetch.
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!id) return;
    if (!confirm('Delete this application? This cannot be undone.')) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await applicationsApi.remove(id);
      navigate('/applications', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Unable to delete this application.');
      setDeleting(false);
    }
  }

  if (asyncStatus === 'loading') return <LoadingState label="Loading application…" />;
  if (asyncStatus === 'error') return <ErrorState message={error} onRetry={refetch} />;

  const sourceLabel = application.source ? SOURCE_LABELS[application.source] ?? null : null;

  return (
    <div className="page app-detail">
      <div className="page-header app-detail-header">
        <div className="app-detail-headline">
          <Link to="/applications" className="back-link">
            ← Applications
          </Link>
          <h1>{application.position}</h1>
          <div className="app-detail-sub">
            <span className="app-detail-company">{application.company}</span>
            <StatusBadge status={application.status} />
          </div>
          <div className="app-detail-meta">
            <span>{application.location ?? 'Location undisclosed'}</span>
            <span aria-hidden="true">·</span>
            <span>{formatSalaryRange(application.salaryMin, application.salaryMax)}</span>
            <span aria-hidden="true">·</span>
            <span>Added {new Date(application.createdAt).toLocaleDateString()}</span>
            {application.jobUrl && (
              <>
                <span aria-hidden="true">·</span>
                <a href={application.jobUrl} target="_blank" rel="noreferrer">
                  Job posting
                  <ExternalLinkIcon />
                </a>
              </>
            )}
            {sourceLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span>via {sourceLabel}</span>
              </>
            )}
          </div>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Cancel edit' : 'Edit'}
          </button>
          <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      {deleteError && (
        <p className="form-error" role="alert">
          {deleteError}
        </p>
      )}

      <div className="app-workspace">
        {editing && (
          <EditApplicationForm
            application={application}
            onSaved={() => {
              setEditing(false);
              refetch();
            }}
            onCancel={() => setEditing(false)}
          />
        )}

        <ProgressSection
          application={application}
          onUpdated={() => {
            refetch();
            setHistoryRefreshToken((t) => t + 1);
          }}
        />

        <div className="app-workspace-grid">
          <div className="app-workspace-col">
            <InterviewsSection applicationId={application.id} />
            <HistorySection applicationId={application.id} refreshToken={historyRefreshToken} />
          </div>
          <div className="app-workspace-col">
            <ResumeAssignmentSection application={application} onAssigned={refetch} />
            <NotesSection applicationId={application.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EditApplicationForm({
  application,
  onSaved,
  onCancel,
}: {
  application: JobApplication;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [company, setCompany] = useState(application.company);
  const [position, setPosition] = useState(application.position);
  const [salaryMin, setSalaryMin] = useState(application.salaryMin?.toString() ?? '');
  const [salaryMax, setSalaryMax] = useState(application.salaryMax?.toString() ?? '');
  const [location, setLocation] = useState(application.location ?? '');
  const [jobUrl, setJobUrl] = useState(application.jobUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await applicationsApi.update(application.id, {
        company,
        position,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        location: location || undefined,
        jobUrl: jobUrl || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to save changes.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="field-row">
        <label className="field">
          <span>Company</span>
          <input required value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
        <label className="field">
          <span>Position</span>
          <input required value={position} onChange={(e) => setPosition(e.target.value)} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Salary min</span>
          <input type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
        </label>
        <label className="field">
          <span>Salary max</span>
          <input type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Location</span>
        <input value={location} onChange={(e) => setLocation(e.target.value)} />
      </label>
      <label className="field">
        <span>Job posting URL</span>
        <input type="url" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} />
      </label>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

function formatSalaryRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'Salary undisclosed';
  if (min != null && max != null) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  return `$${(min ?? max)!.toLocaleString()}`;
}
