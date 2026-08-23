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

function extractFromDom(doc: Document) {
  return {
    position: firstMatch(doc, TITLE_SELECTORS),
    company: firstMatch(doc, COMPANY_SELECTORS),
    location: firstMatch(doc, LOCATION_SELECTORS),
  };
}

/** Last resort: LinkedIn job page <title> is typically
 * "(N) Job Title hiring at Company | LinkedIn" — imperfect, but better than
 * leaving the field blank when the DOM selectors above miss a layout change. */
function extractFromTitleTag(doc: Document) {
  const raw = cleanText(doc.title).replace(/\s*\|\s*LinkedIn\s*$/i, '');
  const match = raw.match(/^\(?\d*\)?\s*(.+?)\s+hiring at\s+(.+)$/i);
  if (match) {
    return { position: cleanText(match[1]), company: cleanText(match[2]) };
  }
  return raw ? { position: raw } : {};
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
      jobUrl: jsonLd.jobUrl || resolveCanonicalOrCleanUrl(doc, url),
    };
  },
};
