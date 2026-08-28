/** Trims a regex capture and drops a single trailing comma/period a
 * sentence boundary tends to leave behind (e.g. "...at Acme Robotics."). */
export function cleanCapture(value: string): string {
  return value.trim().replace(/[,.]$/, '').trim();
}

/**
 * Runs `patterns` against `text` in order and returns the first match that
 * yields a position and/or company via named `(?<position>…)` /
 * `(?<company>…)` capture groups. Named groups (rather than positional
 * ones) let each pattern place "company" and "position" in whatever order
 * that platform's real phrasing uses ("X at Y" vs "Y viewed your
 * application for X") without the extraction code having to track which
 * group index means what per-pattern.
 */
export function extractWithPatterns(
  text: string,
  patterns: RegExp[],
): { position: string | null; company: string | null } {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.groups) continue;

    const position = match.groups.position ? cleanCapture(match.groups.position) : null;
    const company = match.groups.company ? cleanCapture(match.groups.company) : null;
    if (position || company) return { position, company };
  }
  return { position: null, company: null };
}

/**
 * Loose position/company text fragments shared by every provider's
 * patterns. Real job titles and company names can contain almost any
 * printable character — a real JobStreet email produced a title with a
 * literal "+" in it ("...IT background+ 3-months Free Online Training)"),
 * which broke an earlier version of these patterns that used a punctuation
 * allow-list and silently truncated the capture right at the "+". Rather
 * than keep extending that allow-list one surprising character at a time,
 * these only exclude newlines and rely on each pattern's own literal
 * anchor text ("was successfully submitted to", " at ", …) and terminating
 * lookahead to bound the match instead.
 */
export const POSITION_TEXT = String.raw`[\w][^\n]{1,100}?`;
/** Same, but for patterns whose sentence shape only distinguishes the
 * position from surrounding filler words by it starting with a capital
 * (e.g. a bare "for X at Y" with no "position/role" keyword to anchor on). */
export const POSITION_TEXT_CAP = String.raw`[A-Z][^\n]{1,100}?`;
export const COMPANY_TEXT = String.raw`[A-Z][^\n]{1,90}?`;

/** Required prefix for a capture that has no literal anchor phrase before
 * it (e.g. company-first "X viewed your application for Y" — nothing
 * distinctive precedes "X"). Without this, a permissive capture like
 * COMPANY_TEXT would just as happily start at a preceding greeting on the
 * same line ("Hi Quinn, X viewed..." → "Hi Quinn, X" as the company) as at
 * the real start of that sentence. Real ATS templates put each such
 * sentence in its own paragraph/line, so requiring the capture to begin
 * at a true line start is a safe, evidence-backed way to rule that out. */
export const LINE_START = String.raw`(?:^|\n)\s*`;

/** Short titles whose period is part of the word itself, not a sentence
 * end — "Jr.", "Sr.", etc. — and which are typically followed by *more*
 * of the same title/name ("Jr./Sr. Backend Programmer"), unlike a legal
 * company suffix like "Inc."/"Corp." which is typically the *last* word
 * of the name. A real JobStreet email's "Jr./Sr. Backend Programmer"
 * title used to get truncated to just "Jr", because the trailing
 * boundary stopped at the very first period it saw, full stop, with no
 * way to tell an abbreviation from a real sentence end. Checked via
 * negative lookbehind in TERMINATOR below, so the boundary doesn't fire
 * right after one of these and the capture keeps growing through it
 * instead of stopping short. Deliberately excludes company-legal-suffix
 * abbreviations (Inc, Corp, Ltd, Co, …) — including those here caused
 * "...at Nimbus Cloud Inc. We have received it" to over-capture into
 * "Nimbus Cloud Inc. We", since "Inc." genuinely was the end of that
 * company's name and stopping right after it (as before this whole fix)
 * was already correct. */
const ABBREVIATIONS = String.raw`Jr|Sr|Mr|Mrs|Ms|Dr|St`;
/** Standalone guard, for composing into a pattern that wants an earlier
 * lookahead alternative of its own (e.g. "stop at ' has' too") alongside
 * the plain terminator alternatives. */
export const NOT_ABBREVIATION = String.raw`(?<!\b(?:${ABBREVIATIONS}))`;

/** The trailing boundary for every capture: a period/comma, a newline, or
 * the end of the string — except right after one of the ABBREVIATIONS
 * above, where it's clearly not a real word/sentence end. Deliberately
 * excludes "!" — real titles use it as decoration ("(We Provide
 * Training!)"), not as a sentence-ending mark, and treating it as one
 * truncated that exact title right before the closing paren. */
export const TERMINATOR_ALTS_RAW = String.raw`[.,\n]|$`;
export const TERMINATOR = String.raw`${NOT_ABBREVIATION}(?=${TERMINATOR_ALTS_RAW})`;

/** True if the From header's domain is, or is a subdomain of, one of `domains`. */
export function domainMatches(from: string, domains: string[]): boolean {
  const match = from.match(/@([\w.-]+)/);
  const domain = match?.[1]?.toLowerCase();
  if (!domain) return false;
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

const DATE_PATTERNS: RegExp[] = [
  // "applied on August 20, 2026" / "submitted on Aug 20 2026"
  /\b(?:applied|submitted)\s+on\s+([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})\b/i,
  // "on August 20, 2026" as a weaker, more general fallback
  /\bon\s+([A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})\b/i,
  // ISO-ish "2026-08-20"
  /\b(\d{4}-\d{2}-\d{2})\b/,
];

/** Only ever returns a date the email text explicitly states — never a
 * guess. Callers wanting a fallback (e.g. the message's own received
 * timestamp) apply that themselves; conflating the two here would make a
 * merely-received-that-day email look like it stated a date it didn't. */
export function extractApplicationDate(text: string): Date | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const parsed = new Date(match[1]);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

const BOILERPLATE_LINE_PATTERNS: RegExp[] = [
  /^\s*this is an automated (?:message|email).*$/gim,
  /^\s*please do not reply to this email.*$/gim,
  /^\s*you('| a)re receiving this email because.*$/gim,
  /^\s*to unsubscribe.*$/gim,
  /^\s*©.*$/gim,
  /^\s*all rights reserved.*$/gim,
];

/** "Hi Quinn, " / "Dear Jordan,\n\n" / etc. right at the start of an email.
 * A real JobStreet email confirmed this can share its very first line with
 * the sentence a pattern is trying to parse ("Hi Quinn, your application
 * for X was successfully submitted to Y.") — since a permissive capture
 * with no preceding text is otherwise indistinguishable from a capture
 * that legitimately starts a string, the greeting has to be removed
 * outright rather than guarded against positionally. */
const GREETING_PATTERN = /^\s*(?:hi|hello|hey|dear)\s+[\w' -]{1,40}?,\s*/i;

/** Collapses whitespace, drops a leading greeting, and drops whole
 * boilerplate lines (auto-generated disclaimers, unsubscribe footers,
 * copyright notices) before any pattern matching runs, so none of those
 * can themselves get mistaken for a position/company mention and so
 * line-wrapping/extra blank lines don't break patterns that assume a
 * single line of text. */
export function normalizeEmailText(text: string): string {
  let cleaned = text.replace(/\r\n/g, '\n');
  for (const pattern of BOILERPLATE_LINE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.replace(GREETING_PATTERN, '');
  return cleaned
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
