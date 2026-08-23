import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi } from '../api/applications';
import { interviewsApi } from '../api/interviews';
import type { ApplicationStatus, Interview, JobApplication } from '../api/types';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { DonutChart } from '../components/DonutChart';
import { LineChart } from '../components/LineChart';
import { buildMonthlySeries, buildWeeklySeries, buildYearlySeries } from '../lib/applicationSeries';
import {
  ActivityIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  PlusIcon,
  UsersIcon,
  XCircleIcon,
} from '../components/icons';

type TimeRange = 'week' | 'month' | 'year';

// The list endpoint caps at 100 per page, so pulling the whole history for the
// trend chart means paging through it — there's no bulk/export endpoint to use instead.
async function fetchAllApplications(): Promise<JobApplication[]> {
  const first = await applicationsApi.list({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'asc' });
  if (first.meta.totalPages <= 1) return first.data;

  const rest = await Promise.all(
    Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
      applicationsApi.list({ page: i + 2, limit: 100, sortBy: 'createdAt', sortOrder: 'asc' }),
    ),
  );
  return [first.data, ...rest.map((r) => r.data)].flat();
}

const STATUS_META: { key: 'applied' | 'assessment' | 'interview' | 'offer' | 'rejected'; label: string; color: string }[] = [
  { key: 'applied', label: 'Applied', color: 'var(--color-blue)' },
  { key: 'assessment', label: 'Assessment', color: 'var(--color-warning)' },
  { key: 'interview', label: 'Interview', color: 'var(--color-primary)' },
  { key: 'offer', label: 'Offer', color: 'var(--color-success)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--color-danger)' },
];

// Statuses most likely to have a scheduled interview attached — narrows the
// candidate pool so we don't fetch interviews for every application on the
// dashboard (there's no cross-application interviews endpoint to page through instead).
const INTERVIEW_CANDIDATE_STATUSES: ApplicationStatus[] = ['ASSESSMENT', 'INTERVIEW', 'OFFER'];

type UpcomingInterview = Interview & { application: JobApplication };

export function DashboardPage() {
  const [range, setRange] = useState<TimeRange>('month');

  const { status, data, error, refetch } = useAsync(async () => {
    const [statistics, recent, allApplications, ...candidateLists] = await Promise.all([
      applicationsApi.statistics(),
      applicationsApi.list({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
      fetchAllApplications(),
      ...INTERVIEW_CANDIDATE_STATUSES.map((s) =>
        applicationsApi.list({ page: 1, limit: 10, status: s, sortBy: 'updatedAt', sortOrder: 'desc' }),
      ),
    ]);

    const candidates = candidateLists.flatMap((r) => r.data);
    const interviewLists = await Promise.all(
      candidates.map((application) =>
        interviewsApi.list(application.id).then((list) => list.map((iv) => ({ ...iv, application }))),
      ),
    );

    const now = Date.now();
    const upcomingInterviews: UpcomingInterview[] = interviewLists
      .flat()
      .filter((iv) => new Date(iv.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 5);

    return { statistics, recent: recent.data, allApplications, upcomingInterviews };
  }, []);

  if (status === 'loading') return <LoadingState label="Loading dashboard…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;

  const { statistics, recent, allApplications, upcomingInterviews } = data;

  const trendSeries =
    range === 'week'
      ? buildWeeklySeries(allApplications)
      : range === 'year'
        ? buildYearlySeries(allApplications)
        : buildMonthlySeries(allApplications);

  const kpis = [
    { label: 'Active pipeline', value: statistics.analytics.activePipeline, icon: <ActivityIcon />, iconClass: 'blue' },
    { label: 'Total applications', value: statistics.totalApplications, icon: <BriefcaseIcon />, iconClass: 'cyan' },
    { label: 'Interviews', value: statistics.byStatus.interview, icon: <UsersIcon />, iconClass: 'cyan' },
    { label: 'Offers', value: statistics.byStatus.offer, icon: <CheckCircleIcon />, iconClass: 'success' },
    { label: 'Rejections', value: statistics.byStatus.rejected, icon: <XCircleIcon />, iconClass: 'danger' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link to="/applications/new" className="btn btn-primary">
          <PlusIcon />
          New application
        </Link>
      </div>

      <section className="stat-grid-hero">
        {kpis.map((kpi) => (
          <div className="stat-tile" key={kpi.label}>
            <div className="stat-tile-top">
              <span className={`stat-icon stat-icon-${kpi.iconClass}`}>{kpi.icon}</span>
            </div>
            <span className="stat-value">{kpi.value}</span>
            <span className="stat-label">{kpi.label}</span>
          </div>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="card card-chart">
          <div className="card-header">
            <h2>Applications over time</h2>
            <div className="segmented" role="tablist" aria-label="Time range">
              {(['week', 'month', 'year'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={range === r}
                  className={`segmented-btn ${range === r ? 'segmented-btn-active' : ''}`}
                  onClick={() => setRange(r)}
                >
                  {r === 'week' ? 'Week' : r === 'month' ? 'Month' : 'Year'}
                </button>
              ))}
            </div>
          </div>
          {allApplications.length === 0 ? (
            <EmptyState message="Not enough data yet." />
          ) : (
            <LineChart data={trendSeries} />
          )}
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
                    <span className="list-row-title">{application.position}</span>
                    <span className="list-row-meta">
                      <span className="list-row-company">{application.company}</span>
                      <span className="list-row-subtitle">
                        {new Date(application.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </Link>
                  <StatusBadge status={application.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <h2>Status distribution</h2>
          <div className="donut-layout">
            <DonutChart
              segments={STATUS_META.map((s) => ({
                key: s.key,
                value: statistics.byStatus[s.key],
                color: s.color,
              }))}
            >
              <strong style={{ fontSize: '1.6rem' }}>{statistics.totalApplications}</strong>
              <span>Total</span>
            </DonutChart>
            <ul className="breakdown-list donut-legend">
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
          </div>
        </section>

        <section className="card">
          <h2>Upcoming interviews</h2>
          {upcomingInterviews.length === 0 ? (
            <EmptyState message="No interviews scheduled yet." />
          ) : (
            <ul className="entry-list">
              {upcomingInterviews.map((interview) => (
                <li key={interview.id}>
                  <div>
                    <strong>{interview.application.position}</strong>
                    <span className="muted"> · {interview.application.company}</span>
                    <div className="muted">
                      {new Date(interview.scheduledAt).toLocaleString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <Link to={`/applications/${interview.application.id}`} className="btn btn-secondary">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="page-footer-link">
        <Link to="/statistics">View full statistics →</Link>
      </div>
    </div>
  );
}
