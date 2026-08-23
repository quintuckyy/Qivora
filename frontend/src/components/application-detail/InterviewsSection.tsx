import { useState, type FormEvent } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { interviewsApi, type InterviewPayload } from '../../api/interviews';
import { ApiError } from '../../api/client';
import type { Interview } from '../../api/types';
import { LoadingState } from '../LoadingState';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const emptyForm: InterviewPayload = { title: '', scheduledAt: '', location: '', meetingUrl: '', notes: '' };

export function InterviewsSection({ applicationId }: { applicationId: string }) {
  const { status, data: interviews, error, refetch } = useAsync(
    () => interviewsApi.list(applicationId),
    [applicationId],
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InterviewPayload>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setFormError(null);
  }

  function startEdit(interview: Interview) {
    setForm({
      title: interview.title,
      scheduledAt: toDatetimeLocal(interview.scheduledAt),
      location: interview.location ?? '',
      meetingUrl: interview.meetingUrl ?? '',
      notes: interview.notes ?? '',
    });
    setEditingId(interview.id);
    setShowForm(true);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload: InterviewPayload = {
        title: form.title,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        location: form.location || undefined,
        meetingUrl: form.meetingUrl || undefined,
        notes: form.notes || undefined,
      };
      if (editingId) {
        await interviewsApi.update(applicationId, editingId, payload);
      } else {
        await interviewsApi.create(applicationId, payload);
      }
      setShowForm(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save interview.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(interviewId: string) {
    if (!confirm('Delete this interview?')) return;
    setDeletingId(interviewId);
    try {
      await interviewsApi.remove(applicationId, interviewId);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to delete interview.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Interviews</h2>
        {!showForm && (
          <button type="button" className="btn btn-secondary" onClick={startCreate}>
            Schedule interview
          </button>
        )}
      </div>

      {showForm && (
        <form className="form" onSubmit={handleSubmit}>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <label className="field">
            <span>Title</span>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="field">
            <span>Date &amp; time</span>
            <input
              type="datetime-local"
              required
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Location</span>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </label>
          <label className="field">
            <span>Meeting URL</span>
            <input
              type="url"
              value={form.meetingUrl}
              onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Schedule'}
            </button>
          </div>
        </form>
      )}

      {status === 'loading' && <LoadingState label="Loading interviews…" />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}
      {status === 'success' &&
        (interviews.length === 0 && !showForm ? (
          <EmptyState message="No interviews scheduled yet." />
        ) : (
          <ul className="entry-list">
            {interviews.map((interview) => (
              <li key={interview.id}>
                <div>
                  <strong>{interview.title}</strong>
                  <span className="muted"> · {new Date(interview.scheduledAt).toLocaleString()}</span>
                  {interview.location && <div className="muted">{interview.location}</div>}
                  {interview.meetingUrl && (
                    <div>
                      <a href={interview.meetingUrl} target="_blank" rel="noreferrer">
                        Meeting link
                      </a>
                    </div>
                  )}
                  {interview.notes && <p className="muted">{interview.notes}</p>}
                </div>
                <div className="entry-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => startEdit(interview)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDelete(interview.id)}
                    disabled={deletingId === interview.id}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
