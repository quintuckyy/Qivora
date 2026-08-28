import type { EmailInput } from '../types';
import type { EmailProvider } from './types';
import { COMPANY_TEXT, LINE_START, POSITION_TEXT, TERMINATOR, domainMatches, extractApplicationDate, extractWithPatterns, normalizeEmailText } from './shared';

const LINKEDIN_DOMAINS = ['linkedin.com'];

const PATTERNS: RegExp[] = [
  // LinkedIn's real confirmation email doesn't put the position in the same
  // sentence as "was sent to" at all — the subject/headline only names the
  // company ("Your application was sent to Acme Robotics"), and the
  // position lives separately in a "job card": its own line, followed
  // immediately by a "Company · Location" line. Confirmed from a live
  // email's HTML — after stripping tags, that's exactly two lines.
  new RegExp(String.raw`(?<position>${POSITION_TEXT})\n\s*(?<company>${COMPANY_TEXT})\s*(?:·|\|)`, 'i'),
  // Same job card, but from the *plain-text* part of the email rather than
  // the HTML — confirmed from a real message's raw MIME source, where
  // position/company/location are three bare consecutive lines with no
  // "·" separator at all (that's an HTML-only rendering detail). Company
  // is bounded by nothing but "ends at the next line", which is why this
  // is tried only after the more specific "·" pattern above — that
  // ordering matters, since without a separator this would otherwise
  // happily swallow an HTML-stripped "Company · Location" line whole.
  new RegExp(String.raw`(?<position>${POSITION_TEXT})\n(?<company>${COMPANY_TEXT})\n`, 'i'),
  // "You applied for Full Stack Developer at Acme Robotics"
  new RegExp(
    String.raw`you applied (?:for|to)\s+(?<position>${POSITION_TEXT})\s+at\s+(?<company>${COMPANY_TEXT})${TERMINATOR}`,
    'i',
  ),
  // "Acme Robotics viewed your application for Full Stack Developer" —
  // nothing precedes the company here, so require it to start a line
  // rather than let a same-line greeting get swallowed into the capture
  // (see the identical fix + rationale in jobstreet.ts).
  new RegExp(
    String.raw`${LINE_START}(?<company>${COMPANY_TEXT})\s+viewed your application for\s+(?<position>${POSITION_TEXT})${TERMINATOR}`,
    'i',
  ),
  // "Your application was sent to Acme Robotics" (company only — LinkedIn's
  // notification usually names the job elsewhere in the same email, e.g. a
  // job card, which a company-only match doesn't need to parse for the
  // position to still be a correct, if partial, extraction)
  new RegExp(String.raw`your application (?:was|has been) sent to\s+(?<company>${COMPANY_TEXT})${TERMINATOR}`, 'i'),
];

export const linkedInProvider: EmailProvider = {
  id: 'LinkedIn',

  matches(input: EmailInput) {
    return domainMatches(input.from, LINKEDIN_DOMAINS);
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
