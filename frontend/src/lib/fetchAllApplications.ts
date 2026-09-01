import { applicationsApi } from '../api/applications';
import type { JobApplication } from '../api/types';

/**
 * Pulls a user's entire application history by paging through the list endpoint
 * (it caps at 100 per page and there's no bulk/export route). Used by views that
 * need to bucket or scan every application client-side — the dashboard trend
 * chart and the analytics page.
 */
export async function fetchAllApplications(): Promise<JobApplication[]> {
  const first = await applicationsApi.list({
    page: 1,
    limit: 100,
    sortBy: 'createdAt',
    sortOrder: 'asc',
  });
  if (first.meta.totalPages <= 1) return first.data;

  const rest = await Promise.all(
    Array.from({ length: first.meta.totalPages - 1 }, (_, i) =>
      applicationsApi.list({
        page: i + 2,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      }),
    ),
  );
  return [first.data, ...rest.map((r) => r.data)].flat();
}
