/** A dashed, muted pill for "this field was left blank" — same pill shape as
 * a status badge so it reads as an indicator rather than empty text, but
 * deliberately colorless/dashed so it never looks like a real value or a
 * status. Used anywhere a field can legitimately have nothing to show
 * (a missing salary/location, an email the classifier couldn't extract a
 * position or company from, …). */
export function UndisclosedBadge({ label = 'Undisclosed' }: { label?: string }) {
  return <span className="undisclosed-badge">{label}</span>;
}
