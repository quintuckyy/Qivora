import type { DetectedEmailType, EmailInput, ExtractedEmailInfo } from './types';
import { resolveProvider, genericProvider } from './providers';
import { normalizeEmailText } from './providers/shared';

interface KeywordRule {
  pattern: RegExp;
  weight: number;
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
    { pattern: /\bpursu(?:e|ing) other candidates\b/i, weight: 2 },
    { pattern: /\bnot (?:been )?selected\b/i, weight: 2 },
    { pattern: /\bunfortunately\b/i, weight: 1 },
    { pattern: /\bwish you (?:the )?(?:best|success)\b/i, weight: 1 },
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
    { pattern: /\bcoding challenge\b/i, weight: 3 },
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

function scoreType(rules: KeywordRule[], subject: string, body: string): number {
  let score = 0;
  for (const rule of rules) {
    if (rule.pattern.test(subject)) score += rule.weight * 2;
    else if (rule.pattern.test(body)) score += rule.weight;
  }
  return score;
}

function detectType(subject: string, body: string): { type: DetectedEmailType; confidence: number } {
  let best: { type: DetectedEmailType; score: number } = { type: 'OTHER', score: 0 };

  for (const type of TYPE_PRIORITY) {
    const score = scoreType(TYPE_RULES[type], subject, body);
    if (score > best.score) best = { type, score };
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
