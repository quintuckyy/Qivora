import { useAsync } from '../hooks/useAsync';
import { applicationsApi } from '../api/applications';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { ActivityIcon, BriefcaseIcon, CheckCircleIcon, TrendingUpIcon } from '../components/icons';

const STATUS_META: { key: 'applied' | 'assessment' | 'interview' | 'offer' | 'rejected'; label: string; color: string }[] = [
  { key: 'applied', label: 'Applied', color: 'var(--color-blue)' },
  { key: 'assessment', label: 'Assessment', color: 'var(--color-warning)' },
  { key: 'interview', label: 'Interview', color: 'var(--color-primary)' },
  { key: 'offer', label: 'Offer', color: 'var(--color-success)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--color-danger)' },
];

export function StatisticsPage() {
  const { status, data, error, refetch } = useAsync(() => applicationsApi.statistics(), []);

  if (status === 'loading') return <LoadingState label="Loading statistics…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;

  if (data.totalApplications === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>Statistics</h1>
        </div>
        <EmptyState message="Add applications to see your statistics here." />
      </div>
    );
  }

  const maxMonthlyCount = Math.max(1, ...data.analytics.monthlyApplications.map((m) => m.count));

  return (
    <div className="page">
      <div className="page-header">
        <h1>Statistics</h1>
      </div>

      <section className="stat-grid">
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-icon stat-icon-cyan">
              <BriefcaseIcon />
            </span>
          </div>
          <span className="stat-value">{data.totalApplications}</span>
          <span className="stat-label">Total applications</span>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-icon stat-icon-blue">
              <ActivityIcon />
            </span>
          </div>
          <span className="stat-value">{data.analytics.activePipeline}</span>
          <span className="stat-label">Active pipeline</span>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-icon stat-icon-success">
              <CheckCircleIcon />
            </span>
          </div>
          <span className="stat-value">{data.analytics.successfulApplications}</span>
          <span className="stat-label">Offers</span>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-top">
            <span className="stat-icon stat-icon-warning">
              <TrendingUpIcon />
            </span>
          </div>
          <span className="stat-value">{data.analytics.averageApplicationsPerMonth}</span>
          <span className="stat-label">Avg. applications / month</span>
        </div>
      </section>

      <section className="card">
        <h2>Applications by status</h2>
        <ul className="breakdown-list">
          {STATUS_META.map((s) => (
            <li key={s.key}>
              <span>
                <span className="breakdown-dot" style={{ background: s.color }} />
                {s.label}
              </span>
              <span>{data.byStatus[s.key]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Conversion rates</h2>
        <ul className="breakdown-list">
          <li>
            <span>Assessment rate</span>
            <span>{data.rates.assessmentRate}%</span>
          </li>
          <li>
            <span>Interview rate</span>
            <span>{data.rates.interviewRate}%</span>
          </li>
          <li>
            <span>Offer rate</span>
            <span>{data.rates.offerRate}%</span>
          </li>
          <li>
            <span>Rejection rate</span>
            <span>{data.rates.rejectionRate}%</span>
          </li>
          <li>
            <span>Interview → offer rate</span>
            <span>{data.rates.interviewToOfferRate}%</span>
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Applications per month</h2>
        {data.analytics.monthlyApplications.length === 0 ? (
          <EmptyState message="Not enough data yet." />
        ) : (
          <div className="bar-chart">
            {data.analytics.monthlyApplications.map((entry) => (
              <div className="bar-row" key={entry.month}>
                <span className="bar-label">{entry.month}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(entry.count / maxMonthlyCount) * 100}%` }}
                  />
                </div>
                <span className="bar-value">{entry.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
