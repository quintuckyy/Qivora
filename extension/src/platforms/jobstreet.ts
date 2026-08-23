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

function extractFromDom(doc: Document) {
  return {
    position: firstMatch(doc, TITLE_SELECTORS),
    company: firstMatch(doc, COMPANY_SELECTORS),
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

export const jobStreetExtractor: PlatformExtractor = {
  id: 'jobstreet',

  matches(url) {
    const onJobStreetHost = JOBSTREET_HOSTS.some((host) => hostnameMatches(url.hostname, host));
    return onJobStreetHost && url.pathname.includes('/job/');
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
