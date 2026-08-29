import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import { ApiError } from '../api/client';
import { CheckCircleIcon, EyeIcon, EyeOffIcon, LockIcon, XCircleIcon } from '../components/icons';
import logoMark from '../assets/logo-mark.png';

// The backend deliberately uses this exact wording for every way a token can
// fail to work (unknown, expired, already used) — matching it here is what
// tells "the link itself is bad, go request a new one" apart from any other
// error (a too-short password, a network hiccup), which stays an inline
// error on the form instead of replacing it.
const INVALID_TOKEN_MESSAGE_FRAGMENT = 'invalid or has expired';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(!token);
  const [succeeded, setSucceeded] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword(token!, password);
      setSucceeded(true);
    } catch (err) {
      if (err instanceof ApiError && err.message.includes(INVALID_TOKEN_MESSAGE_FRAGMENT)) {
        setTokenInvalid(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Unable to reset your password right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={logoMark} alt="Qivora" className="app-brand-mark" />
        </div>

        {succeeded ? (
          <div className="auth-state">
            <div className="auth-success-icon">
              <CheckCircleIcon />
            </div>
            <h1>Password reset</h1>
            <p className="auth-subtitle">Your password has been changed. You can now log in with your new password.</p>
            <Link to="/login" className="btn btn-primary">
              Log in
            </Link>
          </div>
        ) : tokenInvalid ? (
          <div className="auth-state">
            <div className="auth-error-icon">
              <XCircleIcon />
            </div>
            <h1>Link invalid or expired</h1>
            <p className="auth-subtitle">
              This password reset link is no longer valid — it may have already been used, or it's older than 20
              minutes. Request a new one to continue.
            </p>
            <Link to="/forgot-password" className="btn btn-primary">
              Request a new link
            </Link>
          </div>
        ) : (
          <form className="form" onSubmit={handleSubmit}>
            <h1>Set a new password</h1>
            <p className="auth-subtitle">Choose a new password for your account.</p>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}

            <label className="field">
              <span className="sr-only">New password</span>
              <div className="field-icon-input field-icon-input-toggle">
                <LockIcon className="field-icon-glyph" aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="field-icon-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <small>At least 8 characters.</small>
            </label>

            <label className="field">
              <span className="sr-only">Confirm new password</span>
              <div className="field-icon-input">
                <LockIcon className="field-icon-glyph" aria-hidden="true" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </label>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset password'}
            </button>

            <p className="auth-switch">
              <Link to="/login">Back to log in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
