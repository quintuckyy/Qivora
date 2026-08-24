import type { PlatformExtractor } from './types';
import { cleanText, firstMatch, hostnameMatches, extractFromJsonLd, resolveCanonicalOrCleanUrl } from './shared';

/** JobStreet operates one storefront per market on a different ccTLD; add
 * more here as needed (see extension/README.md for known limitations). */
const JOBSTREET_HOSTS = ['jobstreet.com', 'jobstreet.com.ph', 'jobstreet.com.sg', 'jobstreet.co.id'];

// SEEK-family sites (JobStreet's parent company) share this `data-automation`
// attribute convention across markets, which tends to be more stable across
// redesigns than hashed/generated class names.
const TITLE_SELECTORS = ['[data-automation="job-detail-title"]'];
const COMPANY_SELECTORS = ['[data-automation="advertiser-name"]'];
const LOCATION_SELECTORS = ['[data-automation="job-detail-location"]'];

/** The "/job/<id>/apply" flow (résumé selection, screening questions, …) is
 * a completely different page from the job posting itself — none of the
 * data-automation attributes above exist there, and document.title reflects
 * the current wizard step ("Choose documents"), not the job. It does render
 * a small "Applying for" summary card, but with only auto-generated,
 * hashed CSS-module classes (no stable hook there either). What IS stable:
 * a real <h1> holding the position, immediately followed by a <span> with
 * the company name — found by first locating the "Applying for" label text
 * itself and reading forward from its container, rather than depending on
 * any class name. */
function extractFromApplySummaryCard(doc: Document): { position: string; company: string } {
  const label = [...doc.querySelectorAll('span')].find((el) => cleanText(el.textContent) === 'Applying for');
  const card = label?.parentElement;
  if (!card) return { position: '', company: '' };

  const h1 = card.querySelector('h1');
  const position = cleanText(h1?.textContent);

  const companySibling = h1?.nextElementSibling;
  const company =
    companySibling && companySibling.tagName.toLowerCase() === 'span' ? cleanText(companySibling.textContent) : '';

  return { position, company };
}

function extractFromDom(doc: Document) {
  const applySummary = extractFromApplySummaryCard(doc);
  return {
    position: firstMatch(doc, TITLE_SELECTORS) || applySummary.position,
    company: firstMatch(doc, COMPANY_SELECTORS) || applySummary.company,
    location: firstMatch(doc, LOCATION_SELECTORS),
  };
}

/** Last resort: JobStreet job page <title> is typically
 * "Job Title - Company | JobStreet <Market>". */
function extractFromTitleTag(doc: Document) {
  const raw = cleanText(doc.title).replace(/\s*\|\s*JobStreet.*$/i, '');
  const parts = raw
    .split(' - ')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return { position: parts[0], company: parts[1] };
  }
  return raw ? { position: raw } : {};
}

/** On the homepage/listing pages (a "Jobs for you"-style panel), the
 * browser's own URL never changes at all as the user clicks between jobs —
 * no query param, no path segment, nothing. The panel itself always links
 * back to the job's real page from its title, though
 * (`<h1 data-automation="job-detail-title"><a href="/job/<id>...">`), so
 * read the job URL from there first rather than trusting the address bar
 * (which has no job-specific info here) or a canonical tag (which, if
 * present at all on a page like this, likely points at the listing page
 * itself, not the individual job). */
function resolveJobUrl(doc: Document, url: URL): string {
  const titleLink = doc.querySelector('[data-automation="job-detail-title"] a[href]');
  const href = titleLink?.getAttribute('href');
  if (href) {
    const resolved = new URL(href, url.origin);
    resolved.search = '';
    resolved.hash = '';
    return resolved.toString();
  }

  return resolveCanonicalOrCleanUrl(doc, url);
}

export const jobStreetExtractor: PlatformExtractor = {
  id: 'jobstreet',

  matches(url, doc) {
    const onJobStreetHost = JOBSTREET_HOSTS.some((host) => hostnameMatches(url.hostname, host));
    if (!onJobStreetHost) return false;
    if (url.pathname.includes('/job/')) return true;

    // No URL signal on this page shape — fall back to checking whether a
    // job panel is actually rendered on the page right now. `doc` is only
    // provided by the content script (unit tests exercising the URL-only
    // behavior above simply don't pass one, and correctly get `false` here).
    return doc?.querySelector('[data-automation="job-detail-title"]') != null;
  },

  extract(doc, url) {
    const jsonLd = extractFromJsonLd(doc);
    const dom = extractFromDom(doc);
    const titleTag = extractFromTitleTag(doc);

    return {
      position: jsonLd.position || dom.position || titleTag.position || '',
      company: jsonLd.company || dom.company || titleTag.company || '',
      location: jsonLd.location || dom.location || '',
      jobUrl: resolveJobUrl(doc, url),
    };
  },
};
