import type { ReactNode } from 'react';

/**
 * A one-line empty state for the application workspace — a compact dashed row
 * instead of the tall centred `.state` panel, so a section with nothing in it
 * doesn't dominate the page.
 */
export function MiniEmpty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mini-empty">
      <span>{children}</span>
      {action}
    </div>
  );
}
