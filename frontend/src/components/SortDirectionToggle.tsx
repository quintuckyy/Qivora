import { ArrowDownIcon } from './icons';

interface SortDirectionToggleProps {
  order: 'asc' | 'desc';
  onToggle: () => void;
}

/** Matches the Dropdown's glass-pill styling so the filter bar reads as one
 * cohesive control group. The arrow icon itself flips 180° rather than
 * swapping icons, so the direction change reads as a single smooth motion. */
export function SortDirectionToggle({ order, onToggle }: SortDirectionToggleProps) {
  return (
    <button
      type="button"
      className="sort-direction-btn"
      data-order={order}
      onClick={onToggle}
      title="Toggle sort direction"
    >
      <ArrowDownIcon className="sort-direction-icon" />
      {order === 'asc' ? 'Ascending' : 'Descending'}
    </button>
  );
}
