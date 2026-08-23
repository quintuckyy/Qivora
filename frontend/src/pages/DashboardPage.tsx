import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi } from '../api/applications';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';

export function DashboardPage() {
  const { status, data, error, refetch } = useAsync(async () => {
    const [statistics, recent] = await Promise.all([
      applicationsApi.statistics(),
      applicationsApi.list({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    ]);
    return { statistics, recent: recent.data };
  }, []);

  if (status === 'loading') return <LoadingState label="Loading dashboard…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;

  const { statistics, recent } = data;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <span className="stat-value">{statistics.totalApplications}</span>
          <span className="stat-label">Total applications</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{statistics.analytics.activePipeline}</span>
          <span className="stat-label">Active pipeline</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{statistics.analytics.successfulApplications}</span>
          <span className="stat-label">Offers received</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{statistics.rates.interviewRate}%</span>
          <span className="stat-label">Interview rate</span>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2>Recent applications</h2>
          <Link to="/applications" className="btn btn-secondary">
            View all
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            message="You haven't added any applications yet."
            action={
              <Link to="/applications/new" className="btn btn-primary">
                Add your first application
              </Link>
            }
          />
        ) : (
          <ul className="list">
            {recent.map((application) => (
              <li key={application.id} className="list-row">
                <Link to={`/applications/${application.id}`} className="list-row-main">
                  <span className="list-row-title">
                    {application.position} · {application.company}
                  </span>
                  <span className="list-row-subtitle">
                    {new Date(application.createdAt).toLocaleDateString()}
                  </span>
                </Link>
                <StatusBadge status={application.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="page-footer-link">
        <Link to="/statistics">View full statistics →</Link>
      </div>
    </div>
  );
}
