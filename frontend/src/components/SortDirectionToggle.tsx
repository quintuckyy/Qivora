import { ArrowDownAZIcon, ArrowUpZAIcon } from './icons';

interface SortDirectionToggleProps {
  order: 'asc' | 'desc';
  onToggle: () => void;
}

/** Matches the Dropdown's glass-pill styling so the filter bar reads as one
 * cohesive control group. Swaps between an A→Z and Z→A glyph rather than
 * rotating a single arrow — a bare arrow only reads as "up/down", while the
 * letter order is what actually communicates the sort direction. */
export function SortDirectionToggle({ order, onToggle }: SortDirectionToggleProps) {
  return (
    <button
      type="button"
      className="sort-direction-btn"
      data-order={order}
      onClick={onToggle}
      title="Toggle sort direction"
    >
      {order === 'asc' ? (
        <ArrowDownAZIcon className="sort-direction-icon" />
      ) : (
        <ArrowUpZAIcon className="sort-direction-icon" />
      )}
      {order === 'asc' ? 'Ascending' : 'Descending'}
    </button>
  );
}
