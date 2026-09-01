import type { JobApplication } from '../api/types';

export interface SeriesPoint {
  key: string;
  /** Short label for the x-axis tick. */
  label: string;
  /** Full human description of the period, e.g. "Aug 11 – Aug 17, 2026". */
  periodLabel: string;
  /** Applications created within this bucket. */
  count: number;
  /** Running total of applications created on or before the end of this bucket. */
  cumulative: number;
  /** Bucket bounds as epoch ms, half-open [start, end). */
  start: number;
  end: number;
}

interface BucketDef {
  key: string;
  label: string;
  periodLabel: string;
  start: number;
  end: number;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Fill each bucket with its own count plus the running cumulative total. The
 * cumulative figure counts every application created on or before the bucket's
 * end — including ones that fall before the first visible bucket — so the
 * "total to date" shown on hover stays correct no matter how narrow the window.
 */
function assemble(applications: JobApplication[], buckets: BucketDef[]): SeriesPoint[] {
  const times = applications
    .map((a) => new Date(a.createdAt).getTime())
    .filter((t) => Number.isFinite(t));

  return buckets.map((b) => ({
    key: b.key,
    label: b.label,
    periodLabel: b.periodLabel,
    count: times.filter((t) => t >= b.start && t < b.end).length,
    cumulative: times.filter((t) => t < b.end).length,
    start: b.start,
    end: b.end,
  }));
}

const shortDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const shortDateYear = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function buildWeeklySeries(applications: JobApplication[], weeks = 8): SeriesPoint[] {
  const currentWeekStart = startOfWeek(new Date());
  const buckets: BucketDef[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const lastDay = new Date(end);
    lastDay.setDate(lastDay.getDate() - 1);

    buckets.push({
      key: toKey(start),
      label: shortDate(start),
      periodLabel: `${shortDate(start)} – ${shortDateYear(lastDay)}`,
      start: start.getTime(),
      end: end.getTime(),
    });
  }

  return assemble(applications, buckets);
}

export function buildMonthlySeries(applications: JobApplication[], months = 6): SeriesPoint[] {
  const now = new Date();
  const buckets: BucketDef[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    buckets.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: start.toLocaleDateString(undefined, { month: 'short' }),
      periodLabel: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      start: start.getTime(),
      end: end.getTime(),
    });
  }

  return assemble(applications, buckets);
}

export function buildYearlySeries(applications: JobApplication[]): SeriesPoint[] {
  const currentYear = new Date().getFullYear();
  const years = applications
    .map((a) => new Date(a.createdAt).getFullYear())
    .filter((y) => Number.isFinite(y));
  const minYear = years.length > 0 ? Math.min(...years) : currentYear;
  const maxYear = Math.max(currentYear, ...years);

  const buckets: BucketDef[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    buckets.push({
      key: String(y),
      label: String(y),
      periodLabel: `Calendar year ${y}`,
      start: new Date(y, 0, 1).getTime(),
      end: new Date(y + 1, 0, 1).getTime(),
    });
  }

  return assemble(applications, buckets);
}
