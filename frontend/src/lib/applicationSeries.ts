import type { JobApplication } from '../api/types';

export interface SeriesPoint {
  key: string;
  label: string;
  count: number;
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

export function buildWeeklySeries(applications: JobApplication[], weeks = 8): SeriesPoint[] {
  const buckets: SeriesPoint[] = [];
  const currentWeekStart = startOfWeek(new Date());

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    buckets.push({
      key: toKey(weekStart),
      label: weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: 0,
    });
  }

  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const app of applications) {
    const bucket = byKey.get(toKey(startOfWeek(new Date(app.createdAt))));
    if (bucket) bucket.count += 1;
  }

  return buckets;
}

export function buildMonthlySeries(applications: JobApplication[], months = 6): SeriesPoint[] {
  const now = new Date();
  const buckets: SeriesPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      count: 0,
    });
  }

  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const app of applications) {
    const d = new Date(app.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.count += 1;
  }

  return buckets;
}

export function buildYearlySeries(applications: JobApplication[]): SeriesPoint[] {
  const currentYear = new Date().getFullYear();
  const years = applications.map((a) => new Date(a.createdAt).getFullYear());
  const minYear = years.length > 0 ? Math.min(...years) : currentYear;
  const maxYear = Math.max(currentYear, ...years);

  const buckets: SeriesPoint[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    buckets.push({ key: String(y), label: String(y), count: 0 });
  }

  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const app of applications) {
    const bucket = byKey.get(String(new Date(app.createdAt).getFullYear()));
    if (bucket) bucket.count += 1;
  }

  return buckets;
}
