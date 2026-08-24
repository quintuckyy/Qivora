import type { PlatformExtractor } from './types';
import { cleanText, firstMatch, hostnameMatches, extractFromJsonLd } from './shared';

const TITLE_SELECTORS = [
  'h1.jobsearch-JobInfoHeader-title',
  '[data-testid="jobsearch-JobInfoHeader-title"]',
  '.jobsearch-JobInfoHeader-title-container h1',
];

const COMPANY_SELECTORS = [
  '[data-testid="inlineHeader-companyName"] a',
  '[data-testid="inlineHeader-companyName"]',
  '.jobsearch-InlineCompanyRating a',
  '.jobsearch-CompanyInfoWithoutHeaderImage a',
];

const LOCATION_SELECTORS = [
  '[data-testid="inlineHeader-companyLocation"]',
  '.jobsearch-JobInfoHeader-subtitle .jobsearch-JobInfoHeader-locationText',
  '.jobsearch-CompanyInfoWithoutHeaderImage div:nth-child(2)',
];

/** Indeed's title <h1> often contains a visually-hidden "- job post" suffix
 * (an accessibility label, e.g. `<span class="visually-hidden"> - job
 * post</span>`) — invisible on the page but included in `textContent`
 * regardless. Strip it off whatever we extracted for position. */
function stripJobPostLabel(value: string): string {
  return value.replace(/\s*-\s*job post\s*$/i, '').trim();
}

/** Indeed sometimes packs the location and work arrangement into one
 * element with no whitespace around the "•" divider between them (e.g.
 * "Makati•Hybrid work") — take just the first segment (the location) rather
 * than showing the concatenated mess or losing the location entirely. */
function firstSegment(value: string): string {
  const [first] = value.split(/[•·]/);
  return cleanText(first ?? value);
}

function extractFromDom(doc: Document) {
  return {
    position: stripJobPostLabel(firstMatch(doc, TITLE_SELECTORS)),
    company: firstMatch(doc, COMPANY_SELECTORS),
    location: firstSegment(firstMatch(doc, LOCATION_SELECTORS)),
  };
}

/** Last resort: Indeed job page <title> is typically
 * "Job Title - Company - Location | Indeed.com", though newer pages have
 * been seen as just "Job Title - job post". */
function extractFromTitleTag(doc: Document) {
  const raw = cleanText(doc.title).replace(/\s*[|-]\s*Indeed(\.com)?\s*$/i, '');
  const parts = raw
    .split(' - ')
    .map((part) => part.trim())
    .filter((part) => part && !/^job post$/i.test(part));

  if (parts.length >= 2) {
    return { position: parts[0], company: parts[1], location: parts[2] || '' };
  }
  return parts[0] ? { position: parts[0] } : {};
}

/** Indeed's job identity lives in the `jk` (or `vjk`, on any page showing a
 * job in a side/detail panel — search results, and even the homepage) query
 * parameter, not the path — unlike LinkedIn/JobStreet, stripping the query
 * string here would destroy the thing that identifies the job. Checked
 * *before* the canonical tag deliberately: a <link rel="canonical"> can be
 * left over from the page's initial load and never update as the user
 * clicks between jobs in a panel via client-side routing, which would make
 * every job after the first one viewed on that page falsely resolve to the
 * same jobUrl (and so falsely show "Already saved"). The jk/vjk param, by
 * contrast, is the browser's own current URL — always live. Normalizing
 * every shape to the same `/viewjob?jk=` form also keeps duplicate
 * detection working regardless of which page the user opened the job from. */
function resolveJobUrl(doc: Document, url: URL): string {
  const jobKey = url.searchParams.get('jk') || url.searchParams.get('vjk');
  if (jobKey) {
    const clean = new URL(`${url.protocol}//${url.host}/viewjob`);
    clean.searchParams.set('jk', jobKey);
    return clean.toString();
  }

  const canonical = doc.querySelector('link[rel="canonical"]');
  const canonicalHref = canonical?.getAttribute('href');
  if (canonicalHref) return canonicalHref;

  const clean = new URL(url.toString());
  clean.hash = '';
  return clean.toString();
}

export const indeedExtractor: PlatformExtractor = {
  id: 'indeed',

  // Indeed shows a job detail panel on more than just /viewjob and /jobs —
  // e.g. the homepage ("/?from=gnav-homepage&vjk=...") does it too. The
  // jk/vjk param is the reliable signal a job is actually being viewed,
  // regardless of which page hosts the panel.
  matches(url) {
    if (!hostnameMatches(url.hostname, 'indeed.com')) return false;
    return url.searchParams.has('jk') || url.searchParams.has('vjk');
  },

  extract(doc, url) {
    const jsonLd = extractFromJsonLd(doc);
    const dom = extractFromDom(doc);
    const titleTag = extractFromTitleTag(doc);

    return {
      position: jsonLd.position || dom.position || titleTag.position || '',
      company: jsonLd.company || dom.company || titleTag.company || '',
      location: jsonLd.location || dom.location || titleTag.location || '',
      jobUrl: resolveJobUrl(doc, url),
    };
  },
};
