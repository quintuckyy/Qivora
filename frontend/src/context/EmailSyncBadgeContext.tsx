import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { emailSyncApi } from '../api/emailSync';

// How often to re-poll while nothing else has told us to refresh. There's no
// push channel from the backend, so this is what actually surfaces results
// from the automatic sync job (which runs every ~12 minutes) in the sidebar
// without the user having to do anything — frequent enough to feel current,
// infrequent enough to be a trivial request.
const POLL_INTERVAL_MS = 60 * 1000;

interface EmailSyncBadgeContextValue {
  pendingCount: number;
  refetchPendingCount: () => void;
}

const EmailSyncBadgeContext = createContext<EmailSyncBadgeContextValue | null>(null);

/** Tracks the Email Sync review queue's pending count for the sidebar badge.
 * Scoped to the authenticated shell (see Layout.tsx) — mounts/polls only
 * while the user is logged in, and stops the moment they log out. */
export function EmailSyncBadgeProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(() => {
    emailSyncApi
      .getPendingCount()
      .then(({ count }) => setPendingCount(count))
      .catch(() => {
        // A failed poll just leaves the last-known count in place — the
        // badge isn't critical enough to show an error state over.
      });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const value = useMemo<EmailSyncBadgeContextValue>(
    () => ({ pendingCount, refetchPendingCount: load }),
    [pendingCount, load],
  );

  return <EmailSyncBadgeContext.Provider value={value}>{children}</EmailSyncBadgeContext.Provider>;
}

export function useEmailSyncBadge(): EmailSyncBadgeContextValue {
  const context = useContext(EmailSyncBadgeContext);
  if (!context) {
    throw new Error('useEmailSyncBadge must be used within an EmailSyncBadgeProvider');
  }
  return context;
}
