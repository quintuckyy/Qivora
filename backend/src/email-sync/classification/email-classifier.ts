import type { DetectedEmailType, EmailInput, ExtractedEmailInfo } from './types';
import { resolveProvider, genericProvider } from './providers';
import { normalizeEmailText } from './providers/shared';

interface KeywordRule {
  pattern: RegExp;
  weight: number;
  /** This rule alone can never make its type "win" — only corroborate a
   * match that some other, non-weak rule already qualified. Needed for
   * generic words that show up plenty in email that isn't a rejection at
   * all (e.g. "Unfortunately, our office will be closed Friday" —
   * "unfortunately" alone shouldn't tag an unrelated email as one). */
  weak?: boolean;
}

/** Checked in this order — a message matching both a REJECTION signal and a
 * milder APPLICATION_RECEIVED-style phrase ("thank you for your interest…")
 * should classify as the rejection, so the more specific/rarer categories
 * are evaluated first and the highest-scoring one wins. */
const TYPE_PRIORITY: Exclude<DetectedEmailType, 'OTHER'>[] = [
  'REJECTION',
  'OFFER',
  'INTERVIEW',
  'ASSESSMENT',
  'APPLICATION_RECEIVED',
];

const TYPE_RULES: Record<Exclude<DetectedEmailType, 'OTHER'>, KeywordRule[]> = {
  REJECTION: [
    { pattern: /\bwe regret to inform\b/i, weight: 3 },
    { pattern: /\b(?:not|will not) (?:be )?moving forward\b/i, weight: 3 },
    { pattern: /\bdecided not to (?:move forward|proceed)\b/i, weight: 3 },
    { pattern: /\bposition has been filled\b/i, weight: 3 },
    { pattern: /\bmove forward with other candidates\b/i, weight: 3 },
    { pattern: /\bdecided to (?:move forward|proceed) with other candidates\b/i, weight: 3 },
    { pattern: /\bwill not proceed with your application\b/i, weight: 3 },
    // A real JobStreet rejection template — "...is unlikely to progress
    // further" / "it looks unlikely that your application will progress
    // further" — distinct enough from every other phrase here that it
    // needed its own rule; bounded gap between "unlikely" and "progress"
    // covers both of that template's exact wordings without requiring
    // strict adjacency.
    { pattern: /\bunlikely\b[^.\n]{0,60}\bprogress\b/i, weight: 3 },
    // No strict adjacency to "your application" — real sentences almost
    // always have a position/company clause in between ("your application
    // for X at Y was unsuccessful"), which an exact-phrase match would miss.
    { pattern: /\b(?:was|has been|is) unsuccessful\b/i, weight: 3 },
    { pattern: /\bpursu(?:e|ing) other candidates\b/i, weight: 2 },
    { pattern: /\bnot (?:been )?selected\b/i, weight: 2 },
    // Generic enough to show up outside a rejection entirely (a closure
    // notice, a "sorry for the delay" aside, a congratulatory "we wish you
    // the best in your new role") — `weak` so either can only corroborate
    // an already-qualifying hit above, never classify an email on its own.
    { pattern: /\bunfortunately\b/i, weight: 1, weak: true },
    { pattern: /\bwish you (?:the )?(?:best|success)\b/i, weight: 1, weak: true },
  ],
  OFFER: [
    { pattern: /\bpleased to offer\b/i, weight: 3 },
    { pattern: /\bjob offer\b/i, weight: 3 },
    { pattern: /\boffer of employment\b/i, weight: 3 },
    { pattern: /\bexcited to extend (?:you )?an offer\b/i, weight: 3 },
    { pattern: /\boffer letter\b/i, weight: 3 },
    { pattern: /\bextend(?:ing)? an offer\b/i, weight: 2 },
    { pattern: /\bwelcome to the team\b/i, weight: 1 },
  ],
  INTERVIEW: [
    { pattern: /\binterview invitation\b/i, weight: 3 },
    { pattern: /\bschedule (?:an|your) interview\b/i, weight: 3 },
    { pattern: /\binvite you to (?:an? )?interview\b/i, weight: 3 },
    { pattern: /\bphone screen\b/i, weight: 2 },
    { pattern: /\binvite you (?:for|to) a call\b/i, weight: 2 },
    { pattern: /\bmeet (?:with )?the team\b/i, weight: 1 },
    { pattern: /\binterview process\b/i, weight: 1 },
    { pattern: /\bbook a time\b/i, weight: 1 },
  ],
  ASSESSMENT: [
    // "Coding challenge" alone is generic — practice platforms (LeetCode,
    // HackerRank) use the exact same phrase in routine marketing digests
    // ("join the Daily Coding Challenge") that have nothing to do with any
    // application. `weak` so it can only corroborate a genuine invite that
    // already qualifies via a more specific phrase below.
    { pattern: /\bcoding challenge\b/i, weight: 3, weak: true },
    { pattern: /\bcoding (?:test|assessment)\b/i, weight: 3 },
    { pattern: /\btake[- ]home (?:test|assignment|assessment)\b/i, weight: 3 },
    { pattern: /\btechnical (?:test|assessment)\b/i, weight: 3 },
    { pattern: /\bonline assessment\b/i, weight: 3 },
    { pattern: /\bhackerrank\b/i, weight: 2 },
    { pattern: /\bcodesignal\b/i, weight: 2 },
    { pattern: /\bskills? (?:test|assessment)\b/i, weight: 2 },
  ],
  APPLICATION_RECEIVED: [
    { pattern: /\bapplication (?:has been |was )?received\b/i, weight: 2 },
    { pattern: /\bthank you for applying\b/i, weight: 2 },
    { pattern: /\bwe(?:'ve| have) received your application\b/i, weight: 2 },
    { pattern: /\bsuccessfully submitted\b/i, weight: 2 },
    { pattern: /\byour application (?:was|has been) (?:sent|submitted)\b/i, weight: 2 },
    { pattern: /\byou applied (?:for|to)\b/i, weight: 2 },
    { pattern: /\byour application (?:to|for)\b/i, weight: 1 },
  ],
};

/** Notification emails that mention an application only in passing while
 * reporting on the *job listing's* lifecycle, not the applicant's status —
 * e.g. JobStreet's "this job has expired" nudge. These would otherwise trip
 * APPLICATION_RECEIVED's "you applied for" rule (the listing recaps the job
 * you applied to) and generate a bogus "new application" suggestion for an
 * application that already exists. Checked before scoring so they short-
 * circuit straight to OTHER regardless of what else matches. */
const NOISE_PATTERNS: RegExp[] = [
  /\b(?:job|listing|posting) .{0,40}\bhas (?:now )?expired\b/i,
  /\bno longer (?:taking|accepting) applications\b/i,
];

function isNoiseEmail(subject: string, body: string): boolean {
  return NOISE_PATTERNS.some((pattern) => pattern.test(subject) || pattern.test(body));
}

function scoreType(rules: KeywordRule[], subject: string, body: string): { score: number; qualifies: boolean } {
  let score = 0;
  let qualifies = false;
  for (const rule of rules) {
    const hitSubject = rule.pattern.test(subject);
    const hitBody = !hitSubject && rule.pattern.test(body);
    if (!hitSubject && !hitBody) continue;

    score += hitSubject ? rule.weight * 2 : rule.weight;
    if (!rule.weak) qualifies = true;
  }
  return { score, qualifies };
}

function detectType(subject: string, body: string): { type: DetectedEmailType; confidence: number } {
  if (isNoiseEmail(subject, body)) return { type: 'OTHER', confidence: 0 };

  let best: { type: DetectedEmailType; score: number } = { type: 'OTHER', score: 0 };

  for (const type of TYPE_PRIORITY) {
    const { score, qualifies } = scoreType(TYPE_RULES[type], subject, body);
    // A type whose entire score comes from `weak` rules never wins — it can
    // only ride along as corroboration once some other rule for that same
    // type already qualified it.
    if (qualifies && score > best.score) best = { type, score };
  }

  if (best.score === 0) return { type: 'OTHER', confidence: 0 };

  // A single strong subject-line hit (weight 3 * 2 = 6) lands ~0.76;
  // corroborating signals push it toward the 0.95 cap.
  return { type: best.type, confidence: Math.min(0.95, 0.4 + best.score * 0.06) };
}

/** From-header display name as a last resort company hint, e.g.
 * '"Acme Robotics Recruiting" <careers@acmerobotics.com>' -> "Acme Robotics".
 * Only used when no provider (platform-specific or generic) found a
 * company in the subject/body text. A bare address with no "Name <addr>"
 * structure has no display name to fall back to — treating the raw email
 * address itself as a "company" would be a guess, not an extraction, so
 * this returns null rather than doing that. */
function companyFromDisplayName(from: string): string | null {
  const match = from.match(/^"?([^"<]+)"?\s*<[^>]+>/);
  if (!match) return null;

  const raw = match[1].trim();
  if (!raw) return null;

  const cleaned = raw.replace(
    /\s*(?:careers?|recruiting|talent acquisition|hiring team|recruitment|hr team|team|jobs?)\s*$/i,
    '',
  );
  return cleaned.trim() || null;
}

const KNOWN_ATS_DOMAINS: Record<string, string> = {
  'greenhouse.io': 'Greenhouse',
  'lever.co': 'Lever',
  'myworkday.com': 'Workday',
  'myworkdayjobs.com': 'Workday',
  'icims.com': 'iCIMS',
  'smartrecruiters.com': 'SmartRecruiters',
  'bamboohr.com': 'BambooHR',
  'ashbyhq.com': 'Ashby',
  'taleo.net': 'Taleo',
  'successfactors.com': 'SuccessFactors',
  'jobvite.com': 'Jobvite',
  'breezy.hr': 'Breezy HR',
  'workable.com': 'Workable',
};

function detectSource(from: string): string | null {
  const domainMatch = from.match(/@([\w.-]+)/);
  const domain = domainMatch?.[1]?.toLowerCase();
  if (!domain) return null;

  for (const [suffix, label] of Object.entries(KNOWN_ATS_DOMAINS)) {
    if (domain === suffix || domain.endsWith(`.${suffix}`)) return label;
  }
  return domain;
}

export function classifyEmail(input: EmailInput): ExtractedEmailInfo {
  const subject = normalizeEmailText(input.subject);
  const bodyText = normalizeEmailText(input.bodyText);
  const { from } = input;

  const { type, confidence } = detectType(subject, bodyText);

  if (type === 'OTHER') {
    return { type, confidence, company: null, position: null, source: detectSource(from), applicationDate: null };
  }

  const normalizedInput: EmailInput = { subject, bodyText, from };
  const provider = resolveProvider(normalizedInput);
  const extraction = provider.extract(normalizedInput);

  // The platform-specific provider's own template phrasing is the
  // authority; only fall back to the generic patterns (and, after that, the
  // From display name) to fill in whatever it didn't find — never to
  // second-guess or replace what it did find.
  const fallback = provider === genericProvider ? extraction : genericProvider.extract(normalizedInput);

  const position = extraction.position ?? fallback.position;
  const company = extraction.company ?? fallback.company ?? companyFromDisplayName(from);
  const applicationDate = extraction.applicationDate ?? fallback.applicationDate;
  const source = provider === genericProvider ? detectSource(from) : provider.id;

  return { type, confidence, company, position, source, applicationDate };
}
