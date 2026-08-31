import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { applicationsApi } from '../../api/applications';
import { resumesApi } from '../../api/resumes';
import { ApiError } from '../../api/client';
import type { JobApplication } from '../../api/types';
import { ErrorState } from '../ErrorState';
import { FileIcon } from '../icons';
import { MiniEmpty } from './MiniEmpty';

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
  const [editing, setEditing] = useState(false);

  const assignedResume = resumes?.find((r) => r.id === application.resumeId);

  async function handleAssign() {
    if (!selectedResumeId) return;
    setAssignError(null);
    setAssigning(true);
    try {
      await applicationsApi.assignResume(application.id, selectedResumeId);
      setEditing(false);
      onAssigned();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : 'Unable to assign resume.');
    } finally {
      setAssigning(false);
    }
  }

  const showPicker = status === 'success' && (editing || !assignedResume);

  return (
    <section className="card">
      <div className="card-header">
        <h2>Resume</h2>
        {status === 'success' && assignedResume && !editing && resumes.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSelectedResumeId(application.resumeId ?? '');
              setEditing(true);
            }}
          >
            Change
          </button>
        )}
      </div>

      {status === 'loading' && <p className="mini-loading">Loading resumes…</p>}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}

      {status === 'success' && (
        <>
          {assignedResume && !editing && (
            <div className="resume-assigned">
              <FileIcon />
              <span>{assignedResume.originalName}</span>
            </div>
          )}

          {showPicker &&
            (resumes.length === 0 ? (
              <MiniEmpty action={<Link to="/resumes" className="btn btn-secondary btn-sm">Upload</Link>}>
                No resumes uploaded yet.
              </MiniEmpty>
            ) : (
              <div className="inline-control">
                <label className="sr-only" htmlFor="resume-select">
                  Select a resume
                </label>
                <select
                  id="resume-select"
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                >
                  <option value="">Select a resume…</option>
                  {resumes.map((resume) => (
                    <option key={resume.id} value={resume.id}>
                      {resume.originalName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleAssign}
                  disabled={!selectedResumeId || assigning}
                >
                  {assigning ? 'Assigning…' : 'Assign'}
                </button>
                {editing && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}

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
