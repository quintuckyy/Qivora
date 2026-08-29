import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { ApiError } from '../api/client';
import { CheckCircleIcon, MailIcon } from '../components/icons';
import logoMark from '../assets/logo-mark.png';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // The backend always returns this same generic response — a
      // registered and an unregistered email are indistinguishable here on
      // purpose, so the UI never has a "success" vs. "no such account"
      // branch to build in the first place.
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to send a reset link right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={logoMark} alt="" className="app-brand-mark" />
          <span className="auth-brand-name">Qivora</span>
        </div>

        {sent ? (
          <div className="auth-state">
            <div className="auth-success-icon">
              <CheckCircleIcon />
            </div>
            <h1>Check your email</h1>
            <p className="auth-subtitle">
              If an account exists for <strong>{email}</strong>, we've sent a link to reset your password. It
              expires in 20 minutes.
            </p>
            <button type="button" className="btn btn-secondary" onClick={() => setSent(false)}>
              Try a different email
            </button>
            <p className="auth-switch">
              <Link to="/login">Back to log in</Link>
            </p>
          </div>
        ) : (
          <form className="form" onSubmit={handleSubmit}>
            <h1>Forgot password</h1>
            <p className="auth-subtitle">
              Enter the email on your account and we'll send you a link to reset your password.
            </p>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <label className="field">
              <span>Email</span>
              <div className="field-icon-input">
                <MailIcon className="field-icon-glyph" aria-hidden="true" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </label>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>

            <p className="auth-switch">
              Remembered your password? <Link to="/login">Log in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
