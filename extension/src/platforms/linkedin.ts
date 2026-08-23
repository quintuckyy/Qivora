import type { PlatformExtractor, ExtractedJob } from './types';

function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function firstMatch(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    const text = cleanText(el?.textContent);
    if (text) return text;
  }
  return '';
}

interface JsonLdJobPosting {
  '@type'?: string | string[];
  title?: string;
  hiringOrganization?: { name?: string } | { name?: string }[];
  jobLocation?:
    | { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }
    | { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }[];
  url?: string;
}

function isJobPosting(node: unknown): node is JsonLdJobPosting {
  if (!node || typeof node !== 'object') return false;
  const type = (node as JsonLdJobPosting)['@type'];
  return type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));
}

function formatAddress(address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string }): string {
  if (!address) return '';
  return [address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean).join(', ');
}

/** Job boards commonly emit schema.org JobPosting structured data for SEO —
 * reading that is far less brittle than scraping visual DOM classes, which
 * job sites (LinkedIn especially) change often and sometimes obfuscate. */
function extractFromJsonLd(doc: Document): Partial<ExtractedJob> {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

  for (const script of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }

    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const candidate of candidates) {
      if (!isJobPosting(candidate)) continue;

      const org = Array.isArray(candidate.hiringOrganization)
        ? candidate.hiringOrganization[0]
        : candidate.hiringOrganization;
      const location = Array.isArray(candidate.jobLocation) ? candidate.jobLocation[0] : candidate.jobLocation;

      return {
        position: cleanText(candidate.title),
        company: cleanText(org?.name),
        location: formatAddress(location?.address),
        jobUrl: cleanText(candidate.url),
      };
    }
  }

  return {};
}

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

function extractFromDom(doc: Document): Partial<ExtractedJob> {
  return {
    position: firstMatch(doc, TITLE_SELECTORS),
    company: firstMatch(doc, COMPANY_SELECTORS),
    location: firstMatch(doc, LOCATION_SELECTORS),
  };
}

/** Last resort: LinkedIn job page <title> is typically
 * "(N) Job Title hiring at Company | LinkedIn" — imperfect, but better than
 * leaving the field blank when the DOM selectors above miss a layout change. */
function extractFromTitleTag(doc: Document): Partial<ExtractedJob> {
  const raw = cleanText(doc.title).replace(/\s*\|\s*LinkedIn\s*$/i, '');
  const match = raw.match(/^\(?\d*\)?\s*(.+?)\s+hiring at\s+(.+)$/i);
  if (match) {
    return { position: cleanText(match[1]), company: cleanText(match[2]) };
  }
  return raw ? { position: raw } : {};
}

function resolveJobUrl(doc: Document, url: URL): string {
  const canonical = doc.querySelector('link[rel="canonical"]');
  const href = canonical?.getAttribute('href');
  if (href) return href;

  const clean = new URL(url.toString());
  clean.search = '';
  clean.hash = '';
  return clean.toString();
}

export const linkedInExtractor: PlatformExtractor = {
  id: 'linkedin',

  matches(url) {
    return url.hostname.endsWith('linkedin.com') && url.pathname.startsWith('/jobs/');
  },

  extract(doc, url) {
    const jsonLd = extractFromJsonLd(doc);
    const dom = extractFromDom(doc);
    const titleTag = extractFromTitleTag(doc);

    return {
      position: jsonLd.position || dom.position || titleTag.position || '',
      company: jsonLd.company || dom.company || titleTag.company || '',
      location: jsonLd.location || dom.location || '',
      jobUrl: jsonLd.jobUrl || resolveJobUrl(doc, url),
    };
  },
};
