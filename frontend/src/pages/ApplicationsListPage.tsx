import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync, useDebouncedValue } from '../hooks/useAsync';
import { applicationsApi } from '../api/applications';
import { APPLICATION_STATUSES, type ApplicationStatus } from '../api/types';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 10;

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'createdAt', label: 'Date added' },
  { value: 'updatedAt', label: 'Last updated' },
  { value: 'company', label: 'Company' },
  { value: 'position', label: 'Position' },
  { value: 'salaryMin', label: 'Salary (min)' },
  { value: 'salaryMax', label: 'Salary (max)' },
];

export function ApplicationsListPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const search = useDebouncedValue(searchInput, 350);

  // Any filter/sort change should snap back to page 1.
  useEffect(() => {
    setPage(1);
  }, [search, status, sortBy, sortOrder]);

  const { status: asyncStatus, data, error, refetch } = useAsync(
    () =>
      applicationsApi.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
        sortBy,
        sortOrder,
      }),
    [page, search, status, sortBy, sortOrder],
  );

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Applications</h1>
        <Link to="/applications/new" className="btn btn-primary">
          New application
        </Link>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search company, position, or location…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="toolbar-search"
        />

        <select value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus | '')}>
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              Sort: {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setSortOrder((order) => (order === 'asc' ? 'desc' : 'asc'))}
          title="Toggle sort direction"
        >
          {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
        </button>
      </div>

      {asyncStatus === 'loading' && <LoadingState label="Loading applications…" />}
      {asyncStatus === 'error' && <ErrorState message={error} onRetry={refetch} />}

      {asyncStatus === 'success' && data.data.length === 0 && (
        <EmptyState
          message={
            search || status
              ? 'No applications match your search or filter.'
              : "You haven't added any applications yet."
          }
          action={
            !search && !status ? (
              <Link to="/applications/new" className="btn btn-primary">
                Add your first application
              </Link>
            ) : undefined
          }
        />
      )}

      {asyncStatus === 'success' && data.data.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <SortableHeader field="company" label="Company" sortBy={sortBy} onClick={toggleSort} />
                  <SortableHeader field="position" label="Position" sortBy={sortBy} onClick={toggleSort} />
                  <th>Status</th>
                  <th>Location</th>
                  <SortableHeader
                    field="salaryMin"
                    label="Salary range"
                    sortBy={sortBy}
                    onClick={toggleSort}
                  />
                  <SortableHeader field="createdAt" label="Added" sortBy={sortBy} onClick={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {data.data.map((application) => (
                  <tr key={application.id}>
                    <td>
                      <Link to={`/applications/${application.id}`}>{application.company}</Link>
                    </td>
                    <td>{application.position}</td>
                    <td>
                      <StatusBadge status={application.status} />
                    </td>
                    <td>{application.location ?? '—'}</td>
                    <td>{formatSalaryRange(application.salaryMin, application.salaryMax)}</td>
                    <td>{new Date(application.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination meta={data.meta} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function SortableHeader({
  field,
  label,
  sortBy,
  onClick,
}: {
  field: string;
  label: string;
  sortBy: string;
  onClick: (field: string) => void;
}) {
  const active = sortBy === field;
  return (
    <th>
      <button type="button" className={`sort-header ${active ? 'sort-header-active' : ''}`} onClick={() => onClick(field)}>
        {label}
      </button>
    </th>
  );
}

function formatSalaryRange(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—';
  if (min != null && max != null) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  return `$${(min ?? max)!.toLocaleString()}`;
}
