import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi } from '../api/applications';
import { interviewsApi } from '../api/interviews';
import type { ApplicationStatus, Interview, JobApplication } from '../api/types';
import { useEmailSyncBadge } from '../context/EmailSyncBadgeContext';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { DonutChart } from '../components/DonutChart';
import { FindJobsMenu } from '../components/FindJobsMenu';
import { LineChart } from '../components/LineChart';
import { buildMonthlySeries, buildWeeklySeries, buildYearlySeries } from '../lib/applicationSeries';
import { fetchAllApplications } from '../lib/fetchAllApplications';
import {
  ActivityIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  ClockIcon,
  FileIcon,
  MailIcon,
  UsersIcon,
  XCircleIcon,
} from '../components/icons';

type TimeRange = 'week' | 'month' | 'year';

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_DAYS = 14;

// "Open" work — everything except the two terminal-ish outcomes. Stale-follow-up
// and missing-résumé nudges only make sense for applications still in play.
const OPEN_STATUSES: ApplicationStatus[] = ['APPLIED', 'ASSESSMENT', 'INTERVIEW'];
const isOpen = (a: JobApplication) => OPEN_STATUSES.includes(a.status);

// Statuses most likely to have a scheduled interview attached — narrows the
// candidate pool so we don't fetch interviews for every application on the
// dashboard (there's no cross-application interviews endpoint to page through instead).
const INTERVIEW_CANDIDATE_STATUSES: ApplicationStatus[] = ['ASSESSMENT', 'INTERVIEW', 'OFFER'];

type UpcomingInterview = Interview & { application: JobApplication };

// Rotating dashboard greetings. One is picked at random per visit (see below)
// and stays put while the page is open. Each falls back to a name-free variant
// when the user's first name isn't available.
const GREETINGS: ((name: string | null) => string)[] = [
  (n) => (n ? `Welcome back, ${n}` : 'Welcome back'),
  (n) => (n ? `Let's keep the momentum going, ${n}` : "Let's keep the momentum going"),
  (n) => (n ? `Ready for your next opportunity, ${n}?` : 'Ready for your next opportunity?'),
  () => "Here's what's happening in your job search",
  (n) => (n ? `Let's check your pipeline, ${n}` : "Let's check your pipeline"),
  (n) => (n ? `Stay on top of your applications, ${n}` : 'Stay on top of your applications'),
  () => 'Your career journey, updated',
  (n) => (n ? `Let's make progress today, ${n}` : "Let's make progress today"),
  () => "Here's your latest job search activity",
  (n) => (n ? `Keep your search moving, ${n}` : 'Keep your search moving'),
];

const PIPELINE_META = [
  { key: 'applied', label: 'Applied', color: 'var(--color-blue)' },
  { key: 'assessment', label: 'Assessment', color: 'var(--color-warning)' },
  { key: 'interview', label: 'Interview', color: 'var(--color-primary)' },
  { key: 'offer', label: 'Offer', color: 'var(--color-success)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--color-danger)' },
] as const;

interface AttentionItem {
  key: string;
  count: number;
  label: string;
  to: string;
  icon: ReactNode;
  tone: 'warning' | 'danger' | 'primary';
}

export function DashboardPage() {
  const [range, setRange] = useState<TimeRange>('month');
  const { pendingCount } = useEmailSyncBadge();
  const { user } = useAuth();

  // Pick once per mount (i.e. per dashboard visit) so the greeting doesn't
  // shuffle while the user is looking at the page.
  const [greeting] = useState(() => {
    const firstName = user?.firstName?.trim() || null;
    return GREETINGS[Math.floor(Math.random() * GREETINGS.length)](firstName);
  });

  const { status, data, error, refetch } = useAsync(async () => {
    const [statistics, recent, allApplications, ...candidateLists] = await Promise.all([
      applicationsApi.statistics(),
      applicationsApi.list({ page: 1, limit: 4, sortBy: 'createdAt', sortOrder: 'desc' }),
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
    const allInterviews = interviewLists.flat();
    const upcomingInterviews: UpcomingInterview[] = allInterviews
      .filter((iv) => new Date(iv.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 5);

    const weekOut = now + 7 * DAY_MS;
    const interviewsThisWeek = allInterviews.filter((iv) => {
      const at = new Date(iv.scheduledAt).getTime();
      return at >= now && at <= weekOut;
    }).length;

    return { statistics, recent: recent.data, allApplications, upcomingInterviews, interviewsThisWeek };
  }, []);

  if (status === 'loading') return <LoadingState label="Loading dashboard…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;

  const { statistics, recent, allApplications, upcomingInterviews, interviewsThisWeek } = data;

  const trendSeries =
    range === 'week'
      ? buildWeeklySeries(allApplications)
      : range === 'year'
        ? buildYearlySeries(allApplications)
        : buildMonthlySeries(allApplications);

  const now = Date.now();
  const staleCount = allApplications.filter(
    (a) => isOpen(a) && now - new Date(a.updatedAt).getTime() >= STALE_AFTER_DAYS * DAY_MS,
  ).length;
  const noResumeCount = allApplications.filter((a) => isOpen(a) && a.resumeId === null).length;

  const allAttentionItems: AttentionItem[] = [
    {
      key: 'stale',
      count: staleCount,
      label: `${staleCount} ${staleCount === 1 ? 'application' : 'applications'} with no update in ${STALE_AFTER_DAYS}+ days`,
      to: '/applications?sortBy=updatedAt&sortOrder=asc',
      icon: <ClockIcon />,
      tone: 'warning',
    },
    {
      key: 'email-sync',
      count: pendingCount,
      label: `${pendingCount} email sync ${pendingCount === 1 ? 'item' : 'items'} to review`,
      to: '/email-sync',
      icon: <MailIcon />,
      tone: 'primary',
    },
    {
      key: 'interviews',
      count: interviewsThisWeek,
      label: `${interviewsThisWeek} ${interviewsThisWeek === 1 ? 'interview' : 'interviews'} in the next 7 days`,
      to: '/applications?status=INTERVIEW',
      icon: <UsersIcon />,
      tone: 'primary',
    },
    {
      key: 'no-resume',
      count: noResumeCount,
      label: `${noResumeCount} ${noResumeCount === 1 ? 'application has' : 'applications have'} no resume assigned`,
      to: '/applications?resume=missing',
      icon: <FileIcon />,
      tone: 'danger',
    },
  ];
  const attentionItems = allAttentionItems.filter((item) => item.count > 0);

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
        <div className="page-heading">
          <h1>{greeting}</h1>
          <p className="page-subtitle">Your applications, interviews, and pipeline at a glance.</p>
        </div>
        <FindJobsMenu />
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

        <section className="card focus-card">
          <div className="focus-section">
            <h2>Needs attention</h2>
            {attentionItems.length === 0 ? (
              <div className="all-clear">
                <CheckCircleIcon />
                <span>You&rsquo;re all caught up.</span>
              </div>
            ) : (
              <ul className="attention-list">
                {attentionItems.map((item) => (
                  <li key={item.key}>
                    <Link to={item.to} className="attention-row">
                      <span className={`attention-icon attention-icon-${item.tone}`}>{item.icon}</span>
                      <span className="attention-label">{item.label}</span>
                      <ArrowRightIcon className="attention-arrow" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="focus-section">
            <h2>Upcoming interviews</h2>
            {upcomingInterviews.length === 0 ? (
              <p className="focus-empty">No interviews scheduled yet.</p>
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
          </div>
        </section>
      </div>

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

        <section className="card card-pipeline">
          <div className="card-header">
            <h2>Pipeline</h2>
            <Link to="/analytics" className="btn btn-secondary">
              Details
            </Link>
          </div>
          {statistics.totalApplications === 0 ? (
            <EmptyState message="No applications yet." />
          ) : (
            <div className="donut-layout">
              <DonutChart
                segments={PIPELINE_META.map((s) => ({
                  key: s.key,
                  value: statistics.byStatus[s.key],
                  color: s.color,
                }))}
              >
                <strong style={{ fontSize: '1.6rem' }}>{statistics.totalApplications}</strong>
                <span>Total</span>
              </DonutChart>
              <ul className="breakdown-list donut-legend">
                {PIPELINE_META.map((s) => (
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
          )}
        </section>
      </div>
    </div>
  );
}
