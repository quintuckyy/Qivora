import type { EmailInput } from '../types';
import type { EmailProvider } from './types';
import { COMPANY_TEXT, NOT_ABBREVIATION, POSITION_TEXT, TERMINATOR, TERMINATOR_ALTS_RAW, domainMatches, extractApplicationDate, extractWithPatterns, normalizeEmailText } from './shared';

const INDEED_DOMAINS = ['indeed.com'];

const PATTERNS: RegExp[] = [
  // "Application for Full Stack Developer at Acme Robotics has been submitted"
  new RegExp(
    String.raw`application for (?:the\s+)?(?<position>${POSITION_TEXT})\s+at\s+(?<company>${COMPANY_TEXT})${NOT_ABBREVIATION}(?=\s+has\b|${TERMINATOR_ALTS_RAW})`,
    'i',
  ),
  // "Indeed Application: Full Stack Developer" (Indeed's common subject shape — position only)
  new RegExp(String.raw`indeed application:\s*(?<position>${POSITION_TEXT})${TERMINATOR}`, 'i'),
  // "Your application was submitted to Acme Robotics" (company only)
  new RegExp(
    String.raw`your application (?:was|has been) submitted to\s+(?<company>${COMPANY_TEXT})${TERMINATOR}`,
    'i',
  ),
  // "You applied to Acme Robotics" (company only)
  new RegExp(String.raw`you applied to\s+(?<company>${COMPANY_TEXT})${TERMINATOR}`, 'i'),
];

export const indeedProvider: EmailProvider = {
  id: 'Indeed',

  matches(input: EmailInput) {
    return domainMatches(input.from, INDEED_DOMAINS);
  },

  extract(input: EmailInput) {
    const subject = normalizeEmailText(input.subject);
    const body = normalizeEmailText(input.bodyText).slice(0, 4000);

    const fromSubject = extractWithPatterns(subject, PATTERNS);
    const fromBody = extractWithPatterns(body, PATTERNS);

    return {
      position: fromSubject.position ?? fromBody.position,
      company: fromSubject.company ?? fromBody.company,
      applicationDate: extractApplicationDate(`${subject}\n${body}`),
    };
  },
};
