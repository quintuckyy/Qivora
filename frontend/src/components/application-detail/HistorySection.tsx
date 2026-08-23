import { useAsync } from '../../hooks/useAsync';
import { applicationsApi } from '../../api/applications';
import { LoadingState } from '../LoadingState';
import { ErrorState } from '../ErrorState';
import { EmptyState } from '../EmptyState';

export function HistorySection({
  applicationId,
  refreshToken,
}: {
  applicationId: string;
  refreshToken: number;
}) {
  const { status, data, error, refetch } = useAsync(
    () => applicationsApi.history(applicationId),
    [applicationId, refreshToken],
  );

  return (
    <section className="card">
      <h2>Status history</h2>
      {status === 'loading' && <LoadingState label="Loading history…" />}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}
      {status === 'success' &&
        (data.length === 0 ? (
          <EmptyState message="No status changes yet." />
        ) : (
          <ul className="history-list">
            {data.map((entry) => (
              <li key={entry.id}>
                <span>
                  {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : `Created as ${entry.toStatus}`}
                </span>
                <time>{new Date(entry.changedAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
