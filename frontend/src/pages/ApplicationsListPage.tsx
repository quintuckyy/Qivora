import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAsync, useDebouncedValue } from '../hooks/useAsync';
import { applicationsApi } from '../api/applications';
import { APPLICATION_STATUSES, type ApplicationStatus, type PaginatedApplications } from '../api/types';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { StatusBadge, STATUS_LABELS } from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import { SortDirectionToggle } from '../components/SortDirectionToggle';
import { UndisclosedBadge } from '../components/UndisclosedBadge';
import { PlusIcon, SearchIcon, XIcon } from '../components/icons';

const PAGE_SIZE = 10;

const STATUS_OPTIONS: DropdownOption<ApplicationStatus | ''>[] = [
  { value: '', label: 'All statuses' },
  ...APPLICATION_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

const SORT_OPTIONS: DropdownOption<string>[] = [
  { value: 'createdAt', label: 'Date added' },
  { value: 'updatedAt', label: 'Last updated' },
  { value: 'company', label: 'Company' },
  { value: 'position', label: 'Position' },
  { value: 'salaryMin', label: 'Salary (min)' },
  { value: 'salaryMax', label: 'Salary (max)' },
];

const SORT_FIELDS = SORT_OPTIONS.map((o) => o.value);

export function ApplicationsListPage() {
  const navigate = useNavigate();

  // Filters/sort live in the URL so the dashboard's "Needs attention" card (and
  // any bookmarked view) can deep-link straight to a filtered list.
  const [searchParams, setSearchParams] = useSearchParams();

  const statusParam = searchParams.get('status') ?? '';
  const status: ApplicationStatus | '' = APPLICATION_STATUSES.includes(statusParam as ApplicationStatus)
    ? (statusParam as ApplicationStatus)
    : '';
  const sortByParam = searchParams.get('sortBy') ?? '';
  const sortBy = SORT_FIELDS.includes(sortByParam) ? sortByParam : 'createdAt';
  const sortOrder: 'asc' | 'desc' = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  const missingResume = searchParams.get('resume') === 'missing';

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');

  const search = useDebouncedValue(searchInput, 350);

  const hasActiveFilters = Boolean(searchInput.trim() || status || missingResume);

  function patchParams(patch: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (!value) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  }

  function clearFilters() {
    setSearchInput('');
    patchParams({ status: null, resume: null });
  }

  // Any filter/sort change should snap back to page 1.
  useEffect(() => {
    setPage(1);
  }, [search, status, sortBy, sortOrder, missingResume]);

  const { status: asyncStatus, data, error, refetch } = useAsync(
    () =>
      applicationsApi.list({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: status || undefined,
        hasResume: missingResume ? false : undefined,
        sortBy,
        sortOrder,
      }),
    [page, search, status, sortBy, sortOrder, missingResume],
  );

  // Keep the last successful page around so a next/prev (or filter) change can
  // cross-fade — the current rows dim out, then the new page animates in —
  // instead of collapsing to a full-page spinner on every click. `viewSeq`
  // bumps on every new result so the view re-keys and replays its entrance.
  const lastResultRef = useRef<PaginatedApplications | null>(null);
  const viewSeqRef = useRef(0);
  if (asyncStatus === 'success' && data !== lastResultRef.current) {
    viewSeqRef.current += 1;
    lastResultRef.current = data;
  }
  const result = asyncStatus === 'success' ? data : lastResultRef.current;
  const isRefetching = asyncStatus === 'loading' && lastResultRef.current !== null;

  function toggleSort(field: string) {
    if (sortBy === field) {
      patchParams({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      patchParams({ sortBy: field, sortOrder: 'asc' });
    }
  }

  // Whole-row navigation: ignore clicks that landed on the company link (it
  // navigates itself, and keeps cmd/middle-click "open in new tab" working).
  function openApplication(id: string, event: MouseEvent) {
    if (event.defaultPrevented) return;
    if ((event.target as HTMLElement).closest('a')) return;
    navigate(`/applications/${id}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Applications</h1>
        <Link to="/applications/new" className="btn btn-primary">
          <PlusIcon />
          New application
        </Link>
      </div>

      <div className="toolbar">
        <div className="toolbar-search-wrap">
          <SearchIcon className="toolbar-search-icon" />
          <input
            type="search"
            placeholder="Search company, position, or location…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="toolbar-search"
          />
          {searchInput && (
            <button
              type="button"
              className="toolbar-search-clear"
              onClick={() => setSearchInput('')}
              aria-label="Clear search"
              title="Clear search"
            >
              <XIcon />
            </button>
          )}
        </div>

        <div className="toolbar-filters">
          <Dropdown
            value={status}
            options={STATUS_OPTIONS}
            onChange={(value) => patchParams({ status: value })}
            ariaLabel="Filter by status"
          />

          <Dropdown
            value={sortBy}
            options={SORT_OPTIONS}
            onChange={(value) => patchParams({ sortBy: value })}
            ariaLabel="Sort by"
            triggerPrefix="Sort: "
          />

          <SortDirectionToggle
            order={sortOrder}
            onToggle={() => patchParams({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' })}
          />
        </div>
      </div>

      {asyncStatus === 'loading' && !result && <LoadingState label="Loading applications…" />}
      {asyncStatus === 'error' && <ErrorState message={error} onRetry={refetch} />}

      {result && asyncStatus !== 'error' && (result.data.length > 0 || hasActiveFilters) && (
        <div className="applications-results">
          <span className="applications-count">
            {result.meta.total} {result.meta.total === 1 ? 'application' : 'applications'}
          </span>
          {hasActiveFilters && (
            <button type="button" className="clear-filters" onClick={clearFilters}>
              <XIcon />
              Clear filters
            </button>
          )}
        </div>
      )}

      {result && asyncStatus !== 'error' && result.data.length === 0 && !isRefetching && (
        <EmptyState
          message={
            hasActiveFilters
              ? 'No applications match your search or filter.'
              : "You haven't added any applications yet."
          }
          action={
            hasActiveFilters ? undefined : (
              <Link to="/applications/new" className="btn btn-primary">
                Add your first application
              </Link>
            )
          }
        />
      )}

      {result && asyncStatus !== 'error' && result.data.length > 0 && (
        <>
          <div
            key={viewSeqRef.current}
            className={`applications-view${isRefetching ? ' is-refetching' : ''}`}
            aria-busy={isRefetching}
          >
            <div className="table-wrapper applications-table">
              <table className="table">
                <thead>
                  <tr>
                    <SortableHeader field="company" label="Company" sortBy={sortBy} onClick={toggleSort} />
                    <SortableHeader field="position" label="Position" sortBy={sortBy} onClick={toggleSort} />
                    <th className="col-status">Status</th>
                    <th>Location</th>
                    <SortableHeader field="salaryMin" label="Salary range" sortBy={sortBy} onClick={toggleSort} />
                    <SortableHeader field="createdAt" label="Added" sortBy={sortBy} onClick={toggleSort} />
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((application) => (
                    <tr
                      key={application.id}
                      className="application-row"
                      onClick={(event) => openApplication(application.id, event)}
                    >
                      <td className="col-company">
                        <Link
                          to={`/applications/${application.id}`}
                          className="cell-truncate"
                          title={application.company}
                        >
                          {application.company}
                        </Link>
                      </td>
                      <td className="col-position">
                        <span className="cell-truncate" title={application.position}>
                          {application.position}
                        </span>
                      </td>
                      <td className="col-status">
                        <StatusBadge status={application.status} />
                      </td>
                      <td className="col-location">
                        {application.location ? (
                          <span className="cell-truncate" title={application.location}>
                            {application.location}
                          </span>
                        ) : (
                          <UndisclosedBadge />
                        )}
                      </td>
                      <td className="col-salary">
                        {application.salaryMin == null && application.salaryMax == null ? (
                          <UndisclosedBadge />
                        ) : (
                          formatSalaryRange(application.salaryMin, application.salaryMax)
                        )}
                      </td>
                      <td className="col-added">{new Date(application.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="applications-cards">
              {result.data.map((application) => (
                <li key={application.id}>
                  <Link to={`/applications/${application.id}`} className="application-card">
                    <div className="application-card-head">
                      <div className="application-card-titles">
                        <span className="application-card-position">{application.position}</span>
                        <span className="application-card-company">{application.company}</span>
                      </div>
                      <StatusBadge status={application.status} />
                    </div>

                    <div className="application-card-meta">
                      <span>{application.location ?? 'Location undisclosed'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatSalary(application.salaryMin, application.salaryMax)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Added {new Date(application.createdAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <Pagination meta={result.meta} onPageChange={setPage} />
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
  if (min != null && max != null) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  return `$${(min ?? max)!.toLocaleString()}`;
}

function formatSalary(min: number | null, max: number | null): string {
  if (min == null && max == null) return 'Salary undisclosed';
  return formatSalaryRange(min, max);
}
