import type { EmailInput } from '../types';
import type { EmailProvider } from './types';
import { COMPANY_TEXT, LINE_START, NOT_ABBREVIATION, POSITION_TEXT, TERMINATOR, TERMINATOR_ALTS_RAW, domainMatches, extractApplicationDate, extractWithPatterns, normalizeEmailText } from './shared';

/** JobStreet operates one storefront per market on a different ccTLD (see
 * the extension's platforms/jobstreet.ts for the same list) plus SEEK,
 * its parent company, which some notification mail is sent under. */
const JOBSTREET_DOMAINS = ['jobstreet.com', 'jobstreet.com.ph', 'jobstreet.com.sg', 'jobstreet.co.id', 'seek.com'];

// "Web Developer was successfully submitted to FilePino" — the bare
// subject-line shape, with nothing at all before the position. Only ever
// tried against the subject (see extract() below) — tried against body
// text too, this would just as happily match "Hi Quinn, your application
// for Junior Web Designer was successfully submitted to..." and swallow
// everything from "Hi" onward, since nothing here requires an
// "application for" anchor the way the body-oriented patterns do.
const SUBJECT_ONLY_PATTERNS: RegExp[] = [
  new RegExp(
    String.raw`^(?<position>${POSITION_TEXT})\s+was\s+successfully\s+submitted\s+to\s+(?<company>${COMPANY_TEXT})${TERMINATOR}`,
    'i',
  ),
];

const PATTERNS: RegExp[] = [
  // "Your application for Junior Web Designer (Mid shift) was
  // successfully submitted to TENERITY PHILIPPINES CORP." — the body
  // shape, greeting and all, on one line or several. "application for" is
  // a *required* anchor here (not optional) — confirmed from a real email
  // where the greeting and this sentence share one line with no newline
  // between them, so a merely-optional prefix let the position capture
  // swallow "Hi Quinn," right along with it.
  new RegExp(
    String.raw`application for (?<position>${POSITION_TEXT})\s+was\s+successfully\s+submitted\s+to\s+(?<company>${COMPANY_TEXT})${TERMINATOR}`,
    'i',
  ),
  // "Your application for Web Developer at FilePino has been viewed"
  new RegExp(
    String.raw`application for (?:the\s+)?(?<position>${POSITION_TEXT})\s+(?:role\s+)?at\s+(?<company>${COMPANY_TEXT})${NOT_ABBREVIATION}(?=\s+has\b|${TERMINATOR_ALTS_RAW})`,
    'i',
  ),
  // "Your application for Web Developer has been shortlisted by FilePino"
  new RegExp(
    String.raw`application for (?<position>${POSITION_TEXT})\s+has been (?:viewed|shortlisted) by\s+(?<company>${COMPANY_TEXT})${TERMINATOR}`,
    'i',
  ),
  // "FilePino has viewed your application for Web Developer" (company-first —
  // JobStreet's real "viewed" notification template, confirmed from a live
  // email). Nothing but the company itself precedes this sentence, so —
  // same reasoning as the greeting/prefix bug above — require it to start
  // a line rather than let a preceding greeting on the same line get
  // captured as part of the company name.
  new RegExp(
    String.raw`${LINE_START}(?<company>${COMPANY_TEXT})\s+(?:has )?viewed your application for\s+(?<position>${POSITION_TEXT})${TERMINATOR}`,
    'i',
  ),
];

export const jobStreetProvider: EmailProvider = {
  id: 'JobStreet',

  matches(input: EmailInput) {
    return domainMatches(input.from, JOBSTREET_DOMAINS) || /\bjobstreet\b/i.test(`${input.subject} ${input.from}`);
  },

  extract(input: EmailInput) {
    // JobStreet's own notifications tend to put the whole update in a
    // single clean subject line ("<position> was successfully submitted to
    // <company>") — check that first, before the (often boilerplate-heavy) body.
    const subject = normalizeEmailText(input.subject);
    const body = normalizeEmailText(input.bodyText).slice(0, 4000);

    const fromSubject = extractWithPatterns(subject, [...SUBJECT_ONLY_PATTERNS, ...PATTERNS]);
    const fromBody = extractWithPatterns(body, PATTERNS);

    return {
      position: fromSubject.position ?? fromBody.position,
      company: fromSubject.company ?? fromBody.company,
      applicationDate: extractApplicationDate(`${subject}\n${body}`),
    };
  },
};
