import type { EmailInput } from '../types';
import type { EmailProvider } from './types';
import { COMPANY_TEXT, NOT_ABBREVIATION, POSITION_TEXT, POSITION_TEXT_CAP, TERMINATOR, TERMINATOR_ALTS_RAW, extractApplicationDate, extractWithPatterns, normalizeEmailText } from './shared';

/**
 * The fallback used when no platform-specific provider recognizes the
 * email — a direct recruiter/company email, or an ATS whose exact wording
 * isn't covered yet. Real ATS emails overwhelmingly follow a "<position>
 * position/role at <company>" template, so these cover the common
 * phrasings without needing a full NLP pass; anything they miss still
 * surfaces for review with blank fields the user fills in by hand rather
 * than a wrong guess.
 */
const PATTERNS: RegExp[] = [
  new RegExp(
    String.raw`(?:for|to|of) the (?<position>${POSITION_TEXT}) (?:position|role) at (?<company>${COMPANY_TEXT})${NOT_ABBREVIATION}(?=\s+(?:has|have|is|was)\b|${TERMINATOR_ALTS_RAW})`,
    'i',
  ),
  new RegExp(String.raw`position of (?<position>${POSITION_TEXT}) at (?<company>${COMPANY_TEXT})${TERMINATOR}`, 'i'),
  new RegExp(String.raw`\bfor\s+(?<position>${POSITION_TEXT_CAP})\s+at\s+(?<company>${COMPANY_TEXT})${NOT_ABBREVIATION}(?=:|${TERMINATOR_ALTS_RAW})`, 'i'),
  new RegExp(String.raw`(?<position>${POSITION_TEXT_CAP})\s+at\s+(?<company>${COMPANY_TEXT})${NOT_ABBREVIATION}(?=:|${TERMINATOR_ALTS_RAW})`),
  new RegExp(String.raw`thank you for (?:your interest in|applying to)\s+(?<company>${COMPANY_TEXT})${TERMINATOR}`, 'i'),
  new RegExp(String.raw`application (?:to|for)\s+(?<company>${COMPANY_TEXT})${NOT_ABBREVIATION}(?=\s+has\b|${TERMINATOR_ALTS_RAW})`, 'i'),
  new RegExp(String.raw`welcome to (?<company>${COMPANY_TEXT})(?:['’]s)?\s+(?:hiring|recruiting|application) process`, 'i'),
];

export const genericProvider: EmailProvider = {
  id: 'Email',

  // Always available as the last resort — never itself the deciding match.
  matches: () => true,

  extract(input: EmailInput) {
    const body = normalizeEmailText(input.bodyText).slice(0, 4000);
    const subject = normalizeEmailText(input.subject);

    const fromBody = extractWithPatterns(body, PATTERNS);
    const fromSubject = extractWithPatterns(subject, PATTERNS);

    return {
      position: fromBody.position ?? fromSubject.position,
      company: fromBody.company ?? fromSubject.company,
      applicationDate: extractApplicationDate(`${subject}\n${body}`),
    };
  },
};
