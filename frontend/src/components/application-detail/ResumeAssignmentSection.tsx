import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { applicationsApi } from '../../api/applications';
import { resumesApi } from '../../api/resumes';
import { ApiError } from '../../api/client';
import type { JobApplication } from '../../api/types';
import { LoadingState } from '../LoadingState';
import { ErrorState } from '../ErrorState';

export function ResumeAssignmentSection({
  application,
  onAssigned,
}: {
  application: JobApplication;
  onAssigned: () => void;
}) {
  const { status, data: resumes, error, refetch } = useAsync(() => resumesApi.list(), []);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const assignedResume = resumes?.find((r) => r.id === application.resumeId);

  async function handleAssign() {
    if (!selectedResumeId) return;
    setAssignError(null);
    setAssigning(true);
    try {
      await applicationsApi.assignResume(application.id, selectedResumeId);
      onAssigned();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : 'Unable to assign resume.');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <section className="card">
      <h2>Resume</h2>

      {status === 'loading' && <LoadingState label="Loading resumes…" />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}

      {status === 'success' && (
        <>
          <p className="muted">
            {assignedResume ? (
              <>Currently assigned: {assignedResume.originalName}</>
            ) : (
              'No resume assigned yet.'
            )}
          </p>

          {resumes.length === 0 ? (
            <p className="muted">
              You haven&apos;t uploaded any resumes. <Link to="/resumes">Upload one</Link>.
            </p>
          ) : (
            <div className="status-update-row">
              <select value={selectedResumeId} onChange={(e) => setSelectedResumeId(e.target.value)}>
                <option value="">Select a resume…</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.originalName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAssign}
                disabled={!selectedResumeId || assigning}
              >
                {assigning ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          )}

          {assignError && (
            <p className="form-error" role="alert">
              {assignError}
            </p>
          )}
        </>
      )}
    </section>
  );
}
