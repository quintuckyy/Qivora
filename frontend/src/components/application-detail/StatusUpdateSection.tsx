import { useState } from 'react';
import { applicationsApi } from '../../api/applications';
import { ApiError } from '../../api/client';
import { APPLICATION_STATUSES, type ApplicationStatus, type JobApplication } from '../../api/types';

export function StatusUpdateSection({
  application,
  onUpdated,
}: {
  application: JobApplication;
  onUpdated: () => void;
}) {
  const options = APPLICATION_STATUSES.filter((s) => s !== application.status);
  const [nextStatus, setNextStatus] = useState<ApplicationStatus>(options[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await applicationsApi.updateStatus(application.id, nextStatus);
      onUpdated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to update status.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card">
      <h2>Update status</h2>
      {application.status === 'REJECTED' ? (
        <p className="muted">Rejected applications can&apos;t change status.</p>
      ) : (
        <div className="status-update-row">
          <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as ApplicationStatus)}>
            {options.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Updating…' : 'Update'}
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
