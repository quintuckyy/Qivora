interface NavBadgeProps {
  count: number;
}

/** Unread-count badge for a sidebar nav item. Renders nothing at 0 — the
 * badge should disappear entirely when there's nothing pending. Caps the
 * displayed value at "9+" so a large backlog doesn't widen the pill. */
export function NavBadge({ count }: NavBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className="nav-badge"
      role="status"
      aria-label={`${count} pending suggestion${count === 1 ? '' : 's'}`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}
