import { useState, type FormEvent } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { notesApi } from '../../api/notes';
import { ApiError } from '../../api/client';
import type { ApplicationNote } from '../../api/types';
import { LoadingState } from '../LoadingState';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';

export function NotesSection({ applicationId }: { applicationId: string }) {
  const { status, data: notes, error, refetch } = useAsync(() => notesApi.list(applicationId), [applicationId]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startCreate() {
    setContent('');
    setEditingId(null);
    setShowForm(true);
    setFormError(null);
  }

  function startEdit(note: ApplicationNote) {
    setContent(note.content);
    setEditingId(note.id);
    setShowForm(true);
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (editingId) {
        await notesApi.update(applicationId, editingId, content);
      } else {
        await notesApi.create(applicationId, content);
      }
      setShowForm(false);
      refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Unable to save note.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(noteId: string) {
    if (!confirm('Delete this note?')) return;
    setDeletingId(noteId);
    try {
      await notesApi.remove(applicationId, noteId);
      refetch();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to delete note.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Notes</h2>
        {!showForm && (
          <button type="button" className="btn btn-secondary" onClick={startCreate}>
            Add note
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
            <span>Note</span>
            <textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : editingId ? 'Save changes' : 'Add note'}
            </button>
          </div>
        </form>
      )}

      {status === 'loading' && <LoadingState label="Loading notes…" />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}
      {status === 'success' &&
        (notes.length === 0 && !showForm ? (
          <EmptyState message="No notes yet." />
        ) : (
          <ul className="entry-list">
            {notes.map((note) => (
              <li key={note.id}>
                <div>
                  <p>{note.content}</p>
                  <span className="muted">{new Date(note.createdAt).toLocaleString()}</span>
                </div>
                <div className="entry-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => startEdit(note)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDelete(note.id)}
                    disabled={deletingId === note.id}
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
