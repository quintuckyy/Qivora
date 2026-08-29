interface NavBadgeProps {
  count: number;
}

/** Compact unread-count pill for a sidebar nav item. Renders nothing at 0 —
 * the badge should disappear entirely, not show a "0". */
export function NavBadge({ count }: NavBadgeProps) {
  if (count <= 0) return null;
  return <span className="nav-badge">{count > 99 ? '99+' : count}</span>;
}
