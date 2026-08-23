import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi } from '../api/applications';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import {
  ActivityIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  PlusIcon,
  TrendingUpIcon,
  UsersIcon,
  XCircleIcon,
} from '../components/icons';

const STATUS_META: { key: 'applied' | 'assessment' | 'interview' | 'offer' | 'rejected'; label: string; color: string }[] = [
  { key: 'applied', label: 'Applied', color: 'var(--color-blue)' },
  { key: 'assessment', label: 'Assessment', color: 'var(--color-warning)' },
  { key: 'interview', label: 'Interview', color: 'var(--color-primary)' },
  { key: 'offer', label: 'Offer', color: 'var(--color-success)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--color-danger)' },
];

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
  const maxStatusCount = Math.max(1, ...STATUS_META.map((s) => statistics.byStatus[s.key]));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link to="/applications/new" className="btn btn-primary">
          <PlusIcon />
          New application
        </Link>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-icon stat-icon-cyan">
              <BriefcaseIcon />
            </span>
          </div>
          <span className="stat-value">{statistics.totalApplications}</span>
          <span className="stat-label">Total applications</span>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-icon stat-icon-blue">
              <ActivityIcon />
            </span>
          </div>
          <span className="stat-value">{statistics.analytics.activePipeline}</span>
          <span className="stat-label">Active pipeline</span>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-icon stat-icon-cyan">
              <UsersIcon />
            </span>
          </div>
          <span className="stat-value">{statistics.byStatus.interview}</span>
          <span className="stat-label">Interviews</span>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-icon stat-icon-success">
              <CheckCircleIcon />
            </span>
          </div>
          <span className="stat-value">{statistics.byStatus.offer}</span>
          <span className="stat-label">Offers</span>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-icon stat-icon-danger">
              <XCircleIcon />
            </span>
          </div>
          <span className="stat-value">{statistics.byStatus.rejected}</span>
          <span className="stat-label">Rejections</span>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-icon stat-icon-warning">
              <TrendingUpIcon />
            </span>
          </div>
          <span className="stat-value">{statistics.rates.offerRate}%</span>
          <span className="stat-label">Offer conversion</span>
        </div>
      </section>

      <div className="dashboard-grid">
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

        <section className="card">
          <h2>Status distribution</h2>
          <ul className="breakdown-list">
            {STATUS_META.map((s) => (
              <li key={s.key}>
                <span>
                  <span className="breakdown-dot" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span>{statistics.byStatus[s.key]}</span>
              </li>
            ))}
          </ul>
          <div className="bar-chart" style={{ marginTop: '1rem' }}>
            {STATUS_META.map((s) => (
              <div className="bar-row" key={s.key}>
                <span className="bar-label">{s.label}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(statistics.byStatus[s.key] / maxStatusCount) * 100}%`,
                      background: s.color,
                    }}
                  />
                </div>
                <span className="bar-value">{statistics.byStatus[s.key]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="page-footer-link">
        <Link to="/statistics">View full statistics →</Link>
      </div>
    </div>
  );
}
