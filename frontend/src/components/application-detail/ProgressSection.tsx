import { Fragment, useState } from 'react';
import { applicationsApi } from '../../api/applications';
import { ApiError } from '../../api/client';
import { APPLICATION_STATUSES, type ApplicationStatus, type JobApplication } from '../../api/types';
import { STATUS_LABELS } from '../StatusBadge';
import { CheckIcon, XIcon } from '../icons';

/** The forward path an application moves through. `REJECTED` is deliberately
 * excluded — it's a terminal state shown apart from this flow. */
const FLOW: { status: ApplicationStatus; label: string }[] = [
  { status: 'APPLIED', label: 'Applied' },
  { status: 'ASSESSMENT', label: 'Assessment' },
  { status: 'INTERVIEW', label: 'Interview' },
  { status: 'OFFER', label: 'Offer' },
];

export function ProgressSection({
  application,
  onUpdated,
}: {
  application: JobApplication;
  onUpdated: () => void;
}) {
  const isRejected = application.status === 'REJECTED';
  const currentIndex = FLOW.findIndex((s) => s.status === application.status);

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
      <div className="card-header">
        <h2>Progress</h2>
        {isRejected ? (
          <span className="muted pipeline-note">No further status changes</span>
        ) : (
          <div className="inline-control">
            <label className="sr-only" htmlFor="progress-next-status">
              Change status
            </label>
            <select
              id="progress-next-status"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as ApplicationStatus)}
            >
              {options.map((s) => (
                <option key={s} value={s}>
                  Move to {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Updating…' : 'Update'}
            </button>
          </div>
        )}
      </div>

      <div className="pipeline">
        <div className="pipeline-track">
          {FLOW.map((step, i) => {
            const state = isRejected
              ? 'upcoming'
              : i < currentIndex
                ? 'done'
                : i === currentIndex
                  ? 'current'
                  : 'upcoming';
            return (
              <Fragment key={step.status}>
                {i > 0 && (
                  <span
                    className={`pipeline-connector${
                      !isRejected && i <= currentIndex ? ' is-filled' : ''
                    }`}
                  />
                )}
                <div className={`pipeline-step is-${state}`}>
                  <span className="pipeline-node">
                    {state === 'done' ? <CheckIcon /> : i + 1}
                  </span>
                  <span className="pipeline-label">{step.label}</span>
                </div>
              </Fragment>
            );
          })}
        </div>

        <div className={`pipeline-terminal${isRejected ? ' is-current' : ''}`}>
          <span className="pipeline-node">
            <XIcon />
          </span>
          <span className="pipeline-label">Rejected</span>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
