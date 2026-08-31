import { useAsync } from '../../hooks/useAsync';
import { applicationsApi } from '../../api/applications';
import { ErrorState } from '../ErrorState';
import { StatusBadge } from '../StatusBadge';
import { ArrowRightIcon } from '../icons';
import { MiniEmpty } from './MiniEmpty';

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
      <div className="card-header">
        <h2>Status history</h2>
      </div>

      {status === 'loading' && <p className="mini-loading">Loading history…</p>}
      {status === 'error' && <ErrorState message={error} onRetry={refetch} />}
      {status === 'success' &&
        (data.length === 0 ? (
          <MiniEmpty>No status changes yet.</MiniEmpty>
        ) : (
          <ol className="timeline">
            {data.map((entry) => (
              <li key={entry.id} className="timeline-item">
                <span className="timeline-dot" />
                <div className="timeline-body">
                  <span className="timeline-title">
                    {entry.fromStatus ? (
                      <>
                        <StatusBadge status={entry.fromStatus} />
                        <ArrowRightIcon className="timeline-arrow" />
                        <StatusBadge status={entry.toStatus} />
                      </>
                    ) : (
                      <>
                        <span className="timeline-added">Added as</span>
                        <StatusBadge status={entry.toStatus} />
                      </>
                    )}
                  </span>
                  <time className="timeline-time" dateTime={entry.changedAt}>
                    {new Date(entry.changedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        ))}
    </section>
  );
}
