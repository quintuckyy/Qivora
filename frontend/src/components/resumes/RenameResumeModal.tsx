import { useState, type FormEvent } from 'react';
import { resumesApi } from '../../api/resumes';
import { ApiError } from '../../api/client';
import type { Resume } from '../../api/types';
import { Modal } from '../Modal';

const SUGGESTIONS = ['Backend .NET', 'Full-Stack React', 'Fintech', 'General'];

export function RenameResumeModal({
  resume,
  onClose,
  onRenamed,
}: {
  resume: Resume;
  onClose: () => void;
  onRenamed: (updated: Resume) => void;
}) {
  const [name, setName] = useState(resume.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name for this resume.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await resumesApi.rename(resume.id, trimmed);
      onRenamed(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to rename resume.');
      setSaving(false);
    }
  }

  return (
    <Modal title="Rename resume" onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <label className="field">
          <span>Resume name</span>
          <input
            autoFocus
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            aria-describedby="rename-help"
          />
          <small id="rename-help">
            Name it for the kind of role it targets, e.g. a stack or an industry.
          </small>
        </label>

        <div className="rename-suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="rename-suggestion"
              onClick={() => setName(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save name'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
