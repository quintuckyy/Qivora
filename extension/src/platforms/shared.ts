import type { ExtractedJob } from './types';

export function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function firstMatch(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    const text = cleanText(el?.textContent);
    if (text) return text;
  }
  return '';
}

/** True if `hostname` is exactly `root` or a proper subdomain of it
 * (dot-bounded), so e.g. "evillinkedin.com" does not match "linkedin.com". */
export function hostnameMatches(hostname: string, root: string): boolean {
  return hostname === root || hostname.endsWith(`.${root}`);
}

interface JsonLdJobPosting {
  '@type'?: string | string[];
  title?: string;
  hiringOrganization?: { name?: string } | { name?: string }[];
  jobLocation?:
    | { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }
    | { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }[];
  url?: string;
  baseSalary?: {
    value?: { value?: number; minValue?: number; maxValue?: number };
  };
}

/** Numbers embedded in a salary string, comma-grouped and possibly prefixed
 * with a currency symbol/code (e.g. "₱140,000 – ₱150,000 per month",
 * "$50,000 - $70,000 a year", "SGD 4,500 a month" -> a single value repeated
 * as both bounds). Callers scope this to text already known to be a salary
 * (a dedicated DOM node or JSON-LD field), so no other digits are present. */
export function parseSalaryRange(text: string): { salaryMin?: number; salaryMax?: number } {
  const matches = cleanText(text).match(/\d[\d,]*(?:\.\d+)?/g);
  if (!matches) return {};

  const numbers = matches.map((m) => Number(m.replace(/,/g, ''))).filter((n) => Number.isFinite(n) && n > 0);
  if (numbers.length === 0) return {};
  if (numbers.length === 1) return { salaryMin: numbers[0], salaryMax: numbers[0] };

  return { salaryMin: Math.min(numbers[0], numbers[1]), salaryMax: Math.max(numbers[0], numbers[1]) };
}

function extractSalaryFromJsonLdPosting(candidate: JsonLdJobPosting): { salaryMin?: number; salaryMax?: number } {
  const value = candidate.baseSalary?.value;
  if (!value) return {};
  if (typeof value.minValue === 'number' || typeof value.maxValue === 'number') {
    return { salaryMin: value.minValue, salaryMax: value.maxValue ?? value.minValue };
  }
  if (typeof value.value === 'number') {
    return { salaryMin: value.value, salaryMax: value.value };
  }
  return {};
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

/** Many job boards emit schema.org JobPosting structured data for SEO —
 * reading that is far less brittle than scraping visual DOM classes, which
 * job sites redesign often. Shared across platforms since the schema itself
 * isn't site-specific; only the DOM selector fallbacks are per-site. */
export function extractFromJsonLd(doc: Document): Partial<ExtractedJob> {
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
        ...extractSalaryFromJsonLdPosting(candidate),
      };
    }
  }

  return {};
}

/** Canonical link if present, else the current URL with query/hash stripped.
 * Safe for sites (LinkedIn, JobStreet) whose job id lives in the path —
 * NOT for sites like Indeed where the id is itself a query parameter. */
export function resolveCanonicalOrCleanUrl(doc: Document, url: URL): string {
  const canonical = doc.querySelector('link[rel="canonical"]');
  const href = canonical?.getAttribute('href');
  if (href) return href;

  const clean = new URL(url.toString());
  clean.search = '';
  clean.hash = '';
  return clean.toString();
}
