import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { EyeIcon, EyeOffIcon, GoogleIcon, LockIcon, MailIcon } from '../components/icons';
import { isGoogleSignInConfigured, requestGoogleAccessToken } from '../lib/googleIdentity';
import logoMark from '../assets/logo-mark.png';

const googleSignInEnabled = isGoogleSignInConfigured();

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  function goToDestination() {
    const from = (location.state as { from?: Location })?.from;
    navigate(from ? `${from.pathname}${from.search}` : '/', { replace: true });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login({ email, password }, rememberMe);
      goToDestination();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to log in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleClick() {
    setError(null);
    setGoogleSubmitting(true);

    try {
      const accessToken = await requestGoogleAccessToken();
      await loginWithGoogle(accessToken, rememberMe);
      goToDestination();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error && err.message === 'Google sign-in was cancelled.') {
        // The user closed the popup themselves — not worth an error banner.
      } else {
        setError(err instanceof Error ? err.message : 'Unable to sign in with Google. Please try again.');
      }
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <img src={logoMark} alt="" className="app-brand-mark" />
          
        </div>
        <h1>Qivora</h1>
        <p className="auth-subtitle">Your smarter path to the next opportunity.</p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span className="sr-only">Email</span>
          <div className="field-icon-input">
            <MailIcon className="field-icon-glyph" aria-hidden="true" />
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </label>

        <label className="field">
          <span className="sr-only">Password</span>
          <div className="field-icon-input field-icon-input-toggle">
            <LockIcon className="field-icon-glyph" aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              placeholder="Password"
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
        </label>

        <div className="auth-options-row">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>
          <Link to="/forgot-password" className="field-label-action">
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <div className="auth-divider">Or</div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={googleSignInEnabled ? handleGoogleClick : undefined}
          disabled={!googleSignInEnabled || googleSubmitting || submitting}
          title={googleSignInEnabled ? undefined : 'Google sign-in is coming soon'}
          aria-disabled={!googleSignInEnabled}
        >
          <GoogleIcon />
          {googleSubmitting ? 'Signing in…' : 'Continue with Google'}
        </button>
        {!googleSignInEnabled && <p className="btn-google-note">Google sign-in is coming soon.</p>}

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/register">Sign up</Link>
        </p>
      </form>
    </div>
  );
}
