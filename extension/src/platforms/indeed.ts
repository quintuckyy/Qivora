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

function extractFromDom(doc: Document) {
  return {
    position: firstMatch(doc, TITLE_SELECTORS),
    company: firstMatch(doc, COMPANY_SELECTORS),
    location: firstMatch(doc, LOCATION_SELECTORS),
  };
}

/** Last resort: Indeed job page <title> is typically
 * "Job Title - Company - Location | Indeed.com". */
function extractFromTitleTag(doc: Document) {
  const raw = cleanText(doc.title).replace(/\s*[|-]\s*Indeed(\.com)?\s*$/i, '');
  const parts = raw
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { position: parts[0], company: parts[1], location: parts[2] || '' };
  }
  return raw ? { position: raw } : {};
}

/** Indeed's job identity lives in the `jk` (or `vjk`, on search-result panel
 * URLs) query parameter, not the path — unlike LinkedIn/JobStreet, stripping
 * the query string here would destroy the thing that identifies the job.
 * Normalizing both URL shapes to the same `/viewjob?jk=` form also keeps
 * duplicate detection working regardless of which page the user opened. */
function resolveJobUrl(doc: Document, url: URL): string {
  const canonical = doc.querySelector('link[rel="canonical"]');
  const canonicalHref = canonical?.getAttribute('href');
  if (canonicalHref) return canonicalHref;

  const jobKey = url.searchParams.get('jk') || url.searchParams.get('vjk');
  if (jobKey) {
    const clean = new URL(`${url.protocol}//${url.host}/viewjob`);
    clean.searchParams.set('jk', jobKey);
    return clean.toString();
  }

  const clean = new URL(url.toString());
  clean.hash = '';
  return clean.toString();
}

export const indeedExtractor: PlatformExtractor = {
  id: 'indeed',

  matches(url) {
    if (!hostnameMatches(url.hostname, 'indeed.com')) return false;
    if (url.pathname === '/viewjob') return true;
    if (url.pathname === '/jobs' && (url.searchParams.has('vjk') || url.searchParams.has('jk'))) return true;
    return false;
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
