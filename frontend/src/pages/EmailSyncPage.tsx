import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { emailSyncApi } from '../api/emailSync';
import { ApiError } from '../api/client';
import type { DetectedEmailType, EmailSuggestion, GmailSyncResult } from '../api/types';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';

const TYPE_LABELS: Record<DetectedEmailType, string> = {
  APPLICATION_RECEIVED: 'Application received',
  ASSESSMENT: 'Assessment invitation',
  INTERVIEW: 'Interview invitation',
  REJECTION: 'Rejection',
  OFFER: 'Offer',
  OTHER: 'Other',
};

// Reuses the ApplicationStatus badge palette so a detected email type reads
// as the status it would move an application toward.
const TYPE_BADGE_CLASS: Record<DetectedEmailType, string> = {
  APPLICATION_RECEIVED: 'status-applied',
  ASSESSMENT: 'status-assessment',
  INTERVIEW: 'status-interview',
  REJECTION: 'status-rejected',
  OFFER: 'status-offer',
  OTHER: 'status-applied',
};

const TARGET_STATUS_LABEL: Record<DetectedEmailType, string> = {
  APPLICATION_RECEIVED: 'Applied',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  REJECTION: 'Rejected',
  OFFER: 'Offer',
  OTHER: '—',
};

// Mirrors formatCooldown() on the backend (email-sync.service.ts) — kept in
// sync manually since there's no shared package between the two apps.
function formatCooldown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function SuggestionCard({ suggestion, onResolved }: { suggestion: EmailSuggestion; onResolved: () => void }) {
  const [company, setCompany] = useState(suggestion.extractedCompany ?? '');
  const [position, setPosition] = useState(suggestion.extractedPosition ?? '');
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCreate = suggestion.suggestedAction === 'CREATE_APPLICATION';
  const isUpdate = suggestion.suggestedAction === 'UPDATE_STATUS';
  const isNone = suggestion.suggestedAction === 'NONE';

  async function handleConfirm() {
    setError(null);
    setConfirming(true);
    try {
      await emailSyncApi.confirmSuggestion(suggestion.id, isCreate ? { company, position } : undefined);
      onResolved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to confirm this suggestion.');
      setConfirming(false);
    }
  }

  async function handleDismiss() {
    setError(null);
    setDismissing(true);
    try {
      await emailSyncApi.dismissSuggestion(suggestion.id);
      onResolved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to dismiss this suggestion.');
      setDismissing(false);
    }
  }

  return (
    <div className="card suggestion-card">
      <div className="card-header">
        <span className={`status-badge ${TYPE_BADGE_CLASS[suggestion.detectedType]}`}>
          {TYPE_LABELS[suggestion.detectedType]}
        </span>
        {suggestion.receivedAt && <span className="muted">{new Date(suggestion.receivedAt).toLocaleDateString()}</span>}
      </div>

      {suggestion.subject && <p><strong>{suggestion.subject}</strong></p>}
      <p className="muted">
        {suggestion.fromAddress}
        {suggestion.extractedSource && <> · via {suggestion.extractedSource}</>}
      </p>

      {isCreate && (
        <div className="field-row">
          <label className="field">
            <span>Company</span>
            <input value={company} onChange={(event) => setCompany(event.target.value)} />
          </label>
          <label className="field">
            <span>Position</span>
            <input value={position} onChange={(event) => setPosition(event.target.value)} />
          </label>
        </div>
      )}

      {isUpdate && suggestion.matchedApplication && (
        <p>
          Will update <strong>{suggestion.matchedApplication.company}</strong> — {suggestion.matchedApplication.position}{' '}
          from <StatusBadge status={suggestion.matchedApplication.status} /> to{' '}
          <span className={`status-badge ${TYPE_BADGE_CLASS[suggestion.detectedType]}`}>
            {TARGET_STATUS_LABEL[suggestion.detectedType]}
          </span>
        </p>
      )}

      {isNone && (
        <p className="muted">
          {suggestion.matchedApplication
            ? 'No status change needed — this application is already up to date.'
            : 'No matching application found. Dismiss this, or create it manually from the Applications page.'}
        </p>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="status-update-row">
        {!isNone && (
          <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={confirming || dismissing}>
            {confirming ? 'Confirming…' : 'Confirm'}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={handleDismiss} disabled={confirming || dismissing}>
          {dismissing ? 'Dismissing…' : 'Dismiss'}
        </button>
      </div>
    </div>
  );
}

export function EmailSyncPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const code = searchParams.get('code');

  const { status, data: gmailStatus, error: statusError, refetch: refetchStatus } = useAsync(
    () => emailSyncApi.getStatus(),
    [],
  );
  const {
    status: suggestionsStatus,
    data: suggestions,
    error: suggestionsError,
    refetch: refetchSuggestions,
  } = useAsync(() => emailSyncApi.listSuggestions(), []);

  const [connecting, setConnecting] = useState(false);
  const [exchanging, setExchanging] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<GmailSyncResult | null>(null);

  // Ticks once a second only while a cooldown is actually counting down, so
  // the "Sync available in ..." label and the button's disabled state stay
  // live without polling the server.
  const nextSyncAvailableAt =
    status === 'success' && gmailStatus.connected && gmailStatus.nextSyncAvailableAt
      ? new Date(gmailStatus.nextSyncAvailableAt).getTime()
      : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!nextSyncAvailableAt || nextSyncAvailableAt <= Date.now()) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [nextSyncAvailableAt]);
  const cooldownRemainingMs = nextSyncAvailableAt ? nextSyncAvailableAt - now : 0;
  const inCooldown = cooldownRemainingMs > 0;

  // Google redirects back here with ?code=... after the user grants consent;
  // this page completes the OAuth exchange itself (see api/emailSync.ts) so
  // the backend never needs a browser-facing callback route of its own.
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setExchanging(true);
    setExchangeError(null);

    emailSyncApi
      .exchangeCode(code)
      .then(() => {
        if (cancelled) return;
        refetchStatus();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setExchangeError(err instanceof ApiError ? err.message : 'Unable to connect Gmail.');
      })
      .finally(() => {
        if (cancelled) return;
        setExchanging(false);
        setSearchParams({}, { replace: true });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { url } = await emailSyncApi.getAuthUrl();
      window.location.href = url;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to start the Gmail connection.');
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect Gmail? Applications already created from it are kept.')) return;
    setDisconnecting(true);
    try {
      await emailSyncApi.disconnect();
      refetchStatus();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to disconnect Gmail.');
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    setSyncResult(null);
    try {
      const result = await emailSyncApi.sync();
      setSyncResult(result);
      refetchSuggestions();
      refetchStatus(); // picks up the new lastSyncedAt / nextSyncAvailableAt so the cooldown kicks in immediately
    } catch (err) {
      setSyncError(err instanceof ApiError ? err.message : 'Unable to sync Gmail right now.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Email Sync</h1>
      </div>

      <section className="card">
        <div className="card-header">
          <h2>Gmail connection</h2>
        </div>

        {exchanging && <LoadingState label="Connecting Gmail…" />}
        {exchangeError && (
          <p className="form-error" role="alert">
            {exchangeError}
          </p>
        )}

        {!exchanging && status === 'loading' && <LoadingState label="Checking connection…" />}
        {!exchanging && status === 'error' && <ErrorState message={statusError} onRetry={refetchStatus} />}
        {!exchanging && status === 'success' && gmailStatus.connected && (
          <>
            <p>
              Connected as <strong>{gmailStatus.email}</strong>
              {gmailStatus.lastSyncedAt && <> · Last synced {new Date(gmailStatus.lastSyncedAt).toLocaleString()}</>}
              {inCooldown && <> · Sync available in {formatCooldown(cooldownRemainingMs)}</>}
            </p>
            <div className="status-update-row">
              <button type="button" className="btn btn-primary" onClick={handleSync} disabled={syncing || inCooldown}>
                {syncing ? 'Syncing…' : inCooldown ? 'Synced' : 'Sync Gmail'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </>
        )}
        {!exchanging && status === 'success' && !gmailStatus.connected && (
          <>
            <p className="muted">
              Connect Gmail to scan recent email for application confirmations, assessment and interview invitations,
              rejections, and offers. Read-only access — nothing is ever sent, deleted, or changed in your inbox.
            </p>
            <button type="button" className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
              {connecting ? 'Redirecting…' : 'Connect Gmail'}
            </button>
          </>
        )}

        {syncError && (
          <p className="form-error" role="alert">
            {syncError}
          </p>
        )}
        {syncResult && (
          <p className="muted">
            Scanned {syncResult.scanned} recent email{syncResult.scanned === 1 ? '' : 's'} · {syncResult.suggestionsCreated}{' '}
            new suggestion{syncResult.suggestionsCreated === 1 ? '' : 's'} for review
            {syncResult.newlyProcessed === 0 && syncResult.scanned > 0 ? ' (all already processed)' : ''}
          </p>
        )}
      </section>

      <section>
        <h2 className="section-title">Review queue</h2>
        {suggestionsStatus === 'loading' && <LoadingState label="Loading suggestions…" />}
        {suggestionsStatus === 'error' && <ErrorState message={suggestionsError} onRetry={refetchSuggestions} />}
        {suggestionsStatus === 'success' &&
          (suggestions.length === 0 ? (
            <EmptyState message="No suggestions waiting for review. Connect Gmail and click Sync Gmail to scan recent email." />
          ) : (
            <div className="suggestion-list">
              {suggestions.map((suggestion) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} onResolved={refetchSuggestions} />
              ))}
            </div>
          ))}
      </section>
    </div>
  );
}
