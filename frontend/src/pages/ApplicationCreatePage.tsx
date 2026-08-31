import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { applicationsApi } from '../api/applications';
import { ApiError } from '../api/client';

export function ApplicationCreatePage() {
  const navigate = useNavigate();

  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [location, setLocation] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const created = await applicationsApi.create({
        company,
        position,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        location: location || undefined,
        jobUrl: jobUrl || undefined,
        source: 'MANUAL',
      });
      navigate(`/applications/${created.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create the application.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page page-narrow">
      <div className="page-header">
        <h1>New application</h1>
      </div>

      <form className="card form" onSubmit={handleSubmit}>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="field-row">
          <label className="field">
            <span>Company *</span>
            <input required value={company} onChange={(e) => setCompany(e.target.value)} />
          </label>
          <label className="field">
            <span>Position *</span>
            <input required value={position} onChange={(e) => setPosition(e.target.value)} />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Salary min</span>
            <input
              type="number"
              min={0}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Salary max</span>
            <input
              type="number"
              min={0}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>Location</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>

        <label className="field">
          <span>Job posting URL</span>
          <input
            type="url"
            placeholder="https://…"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
          />
        </label>

        <div className="form-actions">
          <Link to="/applications" className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create application'}
          </button>
        </div>
      </form>
    </div>
  );
}
