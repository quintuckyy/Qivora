import type { DetectedEmailType, EmailInput, ExtractedEmailInfo } from './types';

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

/** Tried in order; the first that matches both fields wins. Real ATS emails
 * overwhelmingly follow a "<position> position/role at <company>" template,
 * so these cover the common phrasings without needing a full NLP pass —
 * anything they miss is still surfaced for review with blank fields the
 * user fills in by hand. */
const POSITION_AND_COMPANY_PATTERNS: RegExp[] = [
  /(?:for|to|of) the ([\w][\w &/.,'()-]{1,70}?) (?:position|role) at ([A-Z][\w&.,' -]{1,60}?)(?=[.,!\n]|\s+(?:has|have|is|was)\b|$)/i,
  /position of ([\w][\w &/.,'()-]{1,70}?) at ([A-Z][\w&.,' -]{1,60}?)(?=[.,!\n]|$)/i,
  /\bfor\s+([A-Z][\w &/.,'()-]{1,70}?)\s+at\s+([A-Z][\w&.,' -]{1,60}?)(?=[.,!\n:]|$)/i,
  /([A-Z][\w][\w &/.,'()-]{1,70}?)\s+at\s+([A-Z][\w&.,' -]{1,60}?)(?=[.,!\n:]|$)/,
];

const COMPANY_ONLY_PATTERNS: RegExp[] = [
  /thank you for (?:your interest in|applying to)\s+([A-Z][\w&.,' -]{1,60}?)(?=[.,!\n]|$)/i,
  /application (?:to|for)\s+([A-Z][\w&.,' -]{1,60}?)(?=\s+has\b|[.,!\n]|$)/i,
  /welcome to ([A-Z][\w&.,' -]{1,60}?)(?:['’]s)?\s+(?:hiring|recruiting|application) process/i,
];

function cleanCapture(value: string): string {
  return value.trim().replace(/[,.]$/, '').trim();
}

function extractFromText(text: string): { position: string | null; company: string | null } {
  for (const pattern of POSITION_AND_COMPANY_PATTERNS) {
    const match = text.match(pattern);
    if (match) return { position: cleanCapture(match[1]), company: cleanCapture(match[2]) };
  }
  for (const pattern of COMPANY_ONLY_PATTERNS) {
    const match = text.match(pattern);
    if (match) return { position: null, company: cleanCapture(match[1]) };
  }
  return { position: null, company: null };
}

/** From-header display name as a last resort company hint, e.g.
 * '"Acme Robotics Recruiting" <careers@acmerobotics.com>' -> "Acme Robotics".
 * Only used when no company was found in the subject/body text. */
function companyFromDisplayName(from: string): string | null {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  const raw = (match ? match[1] : from.split('<')[0]).trim();
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
  'linkedin.com': 'LinkedIn',
  'indeed.com': 'Indeed',
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
  const { subject, bodyText, from } = input;
  const { type, confidence } = detectType(subject, bodyText);

  if (type === 'OTHER') {
    return { type, confidence, company: null, position: null, source: detectSource(from) };
  }

  const fromBody = extractFromText(bodyText.slice(0, 4000));
  const fromSubject = extractFromText(subject);

  const company = fromBody.company ?? fromSubject.company ?? companyFromDisplayName(from);
  const position = fromBody.position ?? fromSubject.position;

  return { type, confidence, company, position, source: detectSource(from) };
}
