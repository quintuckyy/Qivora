import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync';
import { applicationsApi } from '../api/applications';
import { resumesApi } from '../api/resumes';
import type { AnalyticsResponse, Resume, StatisticsResponse } from '../api/types';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import {
  CheckCircleIcon,
  ClockIcon,
  FileIcon,
  FunnelIcon,
  MailIcon,
  PencilIcon,
  TrendingUpIcon,
  XCircleIcon,
} from '../components/icons';
import linkedInLogo from '../assets/logos/linkedin.svg';
import jobStreetLogo from '../assets/logos/jobstreet.png';
import indeedLogo from '../assets/logos/indeed.svg';

const SOURCE_META: Record<string, { label: string; logo?: string; icon?: ReactNode }> = {
  LINKEDIN: { label: 'LinkedIn', logo: linkedInLogo },
  JOBSTREET: { label: 'JobStreet', logo: jobStreetLogo },
  INDEED: { label: 'Indeed', logo: indeedLogo },
  EMAIL_SYNC: { label: 'Email Sync', icon: <MailIcon width={15} height={15} /> },
  MANUAL: { label: 'Manual', icon: <PencilIcon width={15} height={15} /> },
};

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export function AnalyticsPage() {
  const { status, data, error, refetch } = useAsync(async () => {
    const [statistics, analytics, resumes] = await Promise.all([
      applicationsApi.statistics(),
      applicationsApi.analytics(),
      resumesApi.list(),
    ]);
    return { statistics, analytics, resumes };
  }, []);

  if (status === 'loading') return <LoadingState label="Loading analytics…" />;
  if (status === 'error') return <ErrorState message={error} onRetry={refetch} />;

  const { statistics, analytics, resumes } = data;

  if (statistics.totalApplications === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-heading">
            <h1>Analytics</h1>
            <p className="page-subtitle">Whether your job-search approach is working.</p>
          </div>
        </div>
        <EmptyState
          message="Add a few applications and move them through your pipeline to unlock analytics."
          action={
            <Link to="/applications/new" className="btn btn-primary">
              Add an application
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-heading">
          <h1>Analytics</h1>
          <p className="page-subtitle">
            How your applications convert, how long it takes, and which resume and source work best.
          </p>
        </div>
      </div>

      <InsightTiles statistics={statistics} analytics={analytics} />

      <FunnelCard analytics={analytics} rejectionRate={statistics.rates.rejectionRate} />

      <div className="analytics-grid">
        <MilestoneCard analytics={analytics} />
        <SourceCard analytics={analytics} />
      </div>

      <ResumePerformanceCard resumes={resumes} />
    </div>
  );
}

/* ---------------------------------------------------------------- Insight tiles */

function InsightTiles({
  statistics,
  analytics,
}: {
  statistics: StatisticsResponse;
  analytics: AnalyticsResponse;
}) {
  const tiles = [
    {
      label: 'Interview rate',
      value: `${statistics.rates.interviewRate}%`,
      caption: `${analytics.funnel.interview} of ${analytics.funnel.applied} applications`,
      icon: <TrendingUpIcon />,
      tone: 'cyan',
    },
    {
      label: 'Offer rate',
      value: `${statistics.rates.offerRate}%`,
      caption: `${analytics.funnel.offer} ${analytics.funnel.offer === 1 ? 'offer' : 'offers'} so far`,
      icon: <CheckCircleIcon />,
      tone: 'success',
    },
    {
      label: 'Rejection rate',
      value: `${statistics.rates.rejectionRate}%`,
      caption: `${statistics.byStatus.rejected} closed without an offer`,
      icon: <XCircleIcon />,
      tone: 'danger',
    },
    {
      label: 'Avg. time to interview',
      value:
        analytics.timing.appliedToInterviewDays == null
          ? '—'
          : `${analytics.timing.appliedToInterviewDays}d`,
      caption:
        analytics.timing.interviewSampleSize === 0
          ? 'No interviews yet'
          : `across ${analytics.timing.interviewSampleSize} ${
              analytics.timing.interviewSampleSize === 1 ? 'application' : 'applications'
            }`,
      icon: <ClockIcon />,
      tone: 'blue',
    },
  ];

  return (
    <section className="stat-grid">
      {tiles.map((tile) => (
        <div className="stat-tile" key={tile.label}>
          <div className="stat-tile-top">
            <span className={`stat-icon stat-icon-${tile.tone}`}>{tile.icon}</span>
          </div>
          <span className="stat-value">{tile.value}</span>
          <span className="stat-label">{tile.label}</span>
          <span className="metric-caption">{tile.caption}</span>
        </div>
      ))}
    </section>
  );
}

/* ---------------------------------------------------------------- Funnel */

function FunnelCard({ analytics, rejectionRate }: { analytics: AnalyticsResponse; rejectionRate: number }) {
  const { applied, assessment, interview, offer } = analytics.funnel;
  const stages = [
    { key: 'applied', label: 'Applied', count: applied },
    { key: 'assessment', label: 'Assessment', count: assessment },
    { key: 'interview', label: 'Interview', count: interview },
    { key: 'offer', label: 'Offer', count: offer },
  ];

  return (
    <section className="card funnel-card">
      <div className="card-header">
        <h2>
          <FunnelIcon width={16} height={16} /> Conversion funnel
        </h2>
        <span className="muted">Applied → Offer</span>
      </div>

      <div className="funnel">
        {stages.map((stage, i) => {
          const previous = i === 0 ? applied : stages[i - 1].count;
          const share = pct(stage.count, applied);
          const step = i === 0 ? null : pct(stage.count, previous);

          return (
            <div className="funnel-row" key={stage.key}>
              <span className="funnel-label">{stage.label}</span>
              <div className="funnel-track">
                <div className="funnel-fill" style={{ width: `${share}%` }} />
              </div>
              <span className="funnel-count">{stage.count}</span>
              <span
                className="funnel-step"
                title={step === null ? undefined : `${step}% advanced from ${stages[i - 1].label}`}
              >
                {step === null ? '' : `${step}%`}
              </span>
            </div>
          );
        })}
      </div>

      <p className="funnel-footnote">
        <XCircleIcon width={14} height={14} />
        {rejectionRate}% of applications ended in rejection
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- Milestone timing */

function MilestoneCard({ analytics }: { analytics: AnalyticsResponse }) {
  const { appliedToInterviewDays, appliedToOfferDays, interviewSampleSize, offerSampleSize } = analytics.timing;
  // Interview and offer averages come from overlapping-but-not-identical sample
  // sets, so the difference can land slightly negative — treat that as "unknown".
  const interviewToOfferRaw =
    appliedToInterviewDays != null && appliedToOfferDays != null
      ? Math.round((appliedToOfferDays - appliedToInterviewDays) * 10) / 10
      : null;
  const interviewToOffer = interviewToOfferRaw != null && interviewToOfferRaw >= 0 ? interviewToOfferRaw : null;

  return (
    <section className="card">
      <div className="card-header">
        <h2>
          <ClockIcon width={16} height={16} /> Time to milestone
        </h2>
      </div>

      {interviewSampleSize === 0 && offerSampleSize === 0 ? (
        <p className="muted">No applications have reached an interview yet.</p>
      ) : (
        <>
          <ol className="milestone">
            <li className="milestone-node">
              <span className="milestone-dot" />
              <span className="milestone-name">Applied</span>
            </li>
            <li className="milestone-gap">
              <span className="milestone-days">
                {appliedToInterviewDays == null ? '—' : `${appliedToInterviewDays} days`}
              </span>
            </li>
            <li className="milestone-node">
              <span className="milestone-dot" />
              <span className="milestone-name">Interview</span>
            </li>
            <li className="milestone-gap">
              <span className="milestone-days">
                {interviewToOffer == null ? '—' : `${interviewToOffer} days`}
              </span>
            </li>
            <li className="milestone-node">
              <span className="milestone-dot milestone-dot-offer" />
              <span className="milestone-name">Offer</span>
            </li>
          </ol>
          <p className="metric-caption">
            {appliedToOfferDays == null
              ? `Based on ${interviewSampleSize} ${
                  interviewSampleSize === 1 ? 'application' : 'applications'
                } that reached an interview.`
              : `Applied → Offer averages ${appliedToOfferDays} days (${offerSampleSize} ${
                  offerSampleSize === 1 ? 'offer' : 'offers'
                }).`}
          </p>
        </>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- By source */

function SourceCard({ analytics }: { analytics: AnalyticsResponse }) {
  const rows = analytics.bySource;
  const max = Math.max(1, ...rows.map((r) => r.applications));

  return (
    <section className="card">
      <div className="card-header">
        <h2>Applications by source</h2>
      </div>

      {rows.length === 0 ? (
        <p className="muted">No sources recorded yet.</p>
      ) : (
        <ul className="source-list">
          {rows.map((row) => {
            const meta = SOURCE_META[row.source] ?? { label: row.source };
            return (
              <li className="source-row" key={row.source}>
                <span className="source-head">
                  {meta.logo ? (
                    <img className="source-logo" src={meta.logo} alt="" width={18} height={18} />
                  ) : (
                    <span className="source-glyph">{meta.icon ?? <FileIcon width={15} height={15} />}</span>
                  )}
                  <span className="source-name">{meta.label}</span>
                  <span className="source-count">{row.applications}</span>
                </span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(row.applications / max) * 100}%` }} />
                </div>
                <span className="source-sub muted">
                  {pct(row.interviews, row.applications)}% reached interview · {row.offers}{' '}
                  {row.offers === 1 ? 'offer' : 'offers'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- Resume performance */

function ResumePerformanceCard({ resumes }: { resumes: Resume[] }) {
  const ranked = [...resumes].sort((a, b) => b.metrics.applications - a.metrics.applications);

  return (
    <section className="card">
      <div className="card-header">
        <h2>
          <FileIcon width={16} height={16} /> Resume performance
        </h2>
        <Link to="/resumes" className="btn btn-secondary btn-sm">
          Manage resumes
        </Link>
      </div>

      {ranked.length === 0 ? (
        <p className="muted">
          No resumes uploaded yet. <Link to="/resumes">Add one</Link> to compare how each version performs.
        </p>
      ) : (
        <div className="table-wrapper analytics-table">
          <table className="table">
            <thead>
              <tr>
                <th>Resume</th>
                <th>Applications</th>
                <th>Interviews</th>
                <th>Offers</th>
                <th>Interview rate</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((resume) => (
                <tr key={resume.id}>
                  <td>
                    <Link to={`/applications?resume=${resume.id}`}>{resume.name}</Link>
                    {resume.isDefault && <span className="mini-tag">Default</span>}
                  </td>
                  <td>{resume.metrics.applications}</td>
                  <td>{resume.metrics.interviews}</td>
                  <td>{resume.metrics.offers}</td>
                  <td>{pct(resume.metrics.interviews, resume.metrics.applications)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
