import type { PlatformExtractor } from './types';
import { cleanText, firstMatch, hostnameMatches, extractFromJsonLd, resolveCanonicalOrCleanUrl } from './shared';

const TITLE_SELECTORS = [
  'h1.job-details-jobs-unified-top-card__job-title',
  'h1.top-card-layout__title',
  '.job-details-jobs-unified-top-card__job-title-link',
  '.jobs-unified-top-card__job-title',
  'main h1',
];

const COMPANY_SELECTORS = [
  '.job-details-jobs-unified-top-card__company-name a',
  '.job-details-jobs-unified-top-card__company-name',
  '.jobs-unified-top-card__company-name a',
  '.jobs-unified-top-card__company-name',
  '.top-card-layout__second-subline a',
];

const LOCATION_SELECTORS = [
  '.job-details-jobs-unified-top-card__primary-description-container .tvm__text',
  '.job-details-jobs-unified-top-card__bullet',
  '.jobs-unified-top-card__bullet',
  '.top-card-layout__second-subline .top-card__flavor--bullet',
];

/** LinkedIn has at least two top-card renderings in the wild: an older one
 * with semantic BEM-style classes (what LOCATION_SELECTORS above targets),
 * and a newer one built with auto-generated, hashed CSS-module class names
 * (e.g. "_762ad6ee") that regenerate on every deploy and can't be targeted
 * reliably at all. Both, however, render the same "Location · X ago · N
 * applicants" line — so as a fallback, match that text *shape* instead of
 * any class name. Scoped to <p> elements with few children to avoid
 * matching some unrelated, much larger container that happens to contain a
 * "·" somewhere in its combined text. */
function extractLocationFromMetaLine(doc: Document): string {
  for (const el of doc.querySelectorAll('p')) {
    if (el.children.length > 8) continue;

    const text = cleanText(el.textContent);
    if (!text.includes('·')) continue;

    const parts = text
      .split('·')
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length >= 2 && /\bago\b/i.test(parts[1]) && parts[0].length > 0 && parts[0].length < 100) {
      return parts[0];
    }
  }
  return '';
}

function extractFromDom(doc: Document) {
  return {
    position: firstMatch(doc, TITLE_SELECTORS),
    company: firstMatch(doc, COMPANY_SELECTORS),
    location: firstMatch(doc, LOCATION_SELECTORS) || extractLocationFromMetaLine(doc),
  };
}

/** Last resort: LinkedIn job page <title> has been observed in two shapes —
 * older "(N) Job Title hiring at Company | LinkedIn", and a newer
 * "Job Title | Company | LinkedIn" pipe-separated form. Neither is
 * guaranteed to stay accurate (LinkedIn changes this without notice), but
 * it beats leaving the field blank when JSON-LD and the DOM selectors above
 * both miss a layout change. */
function extractFromTitleTag(doc: Document) {
  const raw = cleanText(doc.title).replace(/\s*\|\s*LinkedIn\s*$/i, '');

  const hiringAt = raw.match(/^\(?\d*\)?\s*(.+?)\s+hiring at\s+(.+)$/i);
  if (hiringAt) {
    return { position: cleanText(hiringAt[1]), company: cleanText(hiringAt[2]) };
  }

  const pipeSeparated = raw.match(/^(.+?)\s*\|\s*(.+)$/);
  if (pipeSeparated) {
    return { position: cleanText(pipeSeparated[1]), company: cleanText(pipeSeparated[2]) };
  }

  return raw ? { position: raw } : {};
}

/** On /jobs/search-results/ (list view with a detail panel on the right)
 * and similar pages, the job actually being viewed is identified by the
 * currentJobId query parameter, not the path — and NOT reliably by
 * <link rel="canonical"> or a JSON-LD block either, since either can be
 * left over from the page's initial load and never get updated as the
 * user clicks between jobs in the panel via client-side routing. The
 * currentJobId param, by contrast, is the browser's own address-bar URL —
 * always current. Trusting a stale signal here doesn't just mislabel one
 * field: it makes checkDuplicate() key off the wrong job entirely, so
 * every job after the first one saved from a given search page would
 * falsely show "Already saved". Normalize to the standalone
 * /jobs/view/<id>/ shape so it also dedups correctly against a directly
 * opened view of the same job. */
function resolveJobUrl(doc: Document, url: URL): string {
  const jobId = url.searchParams.get('currentJobId');
  if (jobId) {
    return `https://www.linkedin.com/jobs/view/${jobId}/`;
  }
  return resolveCanonicalOrCleanUrl(doc, url);
}

export const linkedInExtractor: PlatformExtractor = {
  id: 'linkedin',

  matches(url) {
    return hostnameMatches(url.hostname, 'linkedin.com') && url.pathname.startsWith('/jobs/');
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
