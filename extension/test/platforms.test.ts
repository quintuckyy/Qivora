import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';
import { findPlatformForUrl } from '../src/platforms';
import { linkedInExtractor } from '../src/platforms/linkedin';
import { indeedExtractor } from '../src/platforms/indeed';
import { jobStreetExtractor } from '../src/platforms/jobstreet';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

function loadFixture(name: string, url: string) {
  const html = readFileSync(join(fixturesDir, name), 'utf-8');
  const dom = new JSDOM(html, { url });
  return { doc: dom.window.document, url: new URL(url) };
}

describe('linkedin extractor', () => {
  it('prefers JSON-LD when present', () => {
    const { doc, url } = loadFixture('linkedin-jsonld.html', 'https://www.linkedin.com/jobs/view/3891234567/?refId=abc&trk=nav');
    const job = linkedInExtractor.extract(doc, url);
    expect(job).toEqual({
      position: 'Senior Backend Engineer',
      company: 'Acme Robotics',
      location: 'Makati, NCR, PH',
      jobUrl: 'https://www.linkedin.com/jobs/view/3891234567/',
    });
  });

  it('falls back to DOM selectors when JSON-LD is absent', () => {
    const { doc, url } = loadFixture('linkedin-dom-only.html', 'https://www.linkedin.com/jobs/view/1112223334/');
    const job = linkedInExtractor.extract(doc, url);
    expect(job.position).toBe('Platform Engineer');
    expect(job.company).toBe('Nimbus Cloud');
    expect(job.location).toBe('Cebu City, Central Visayas, Philippines');
    // no canonical link in this fixture -> falls back to the cleaned current URL
    expect(job.jobUrl).toBe('https://www.linkedin.com/jobs/view/1112223334/');
  });

  it('falls back to the <title> tag when DOM selectors also miss (full redesign)', () => {
    const { doc, url } = loadFixture('linkedin-title-only.html', 'https://www.linkedin.com/jobs/view/5556667778/');
    const job = linkedInExtractor.extract(doc, url);
    expect(job.position).toBe('QA Automation Engineer');
    expect(job.company).toBe('BrightPath Software');
  });

  it('matches only real linkedin.com job-view URLs, not lookalike hosts', () => {
    expect(linkedInExtractor.matches(new URL('https://www.linkedin.com/jobs/view/1/'))).toBe(true);
    expect(linkedInExtractor.matches(new URL('https://www.linkedin.com/feed/'))).toBe(false);
    expect(linkedInExtractor.matches(new URL('https://evillinkedin.com/jobs/view/1/'))).toBe(false);
  });
});

describe('indeed extractor', () => {
  it('prefers JSON-LD and normalizes the URL to /viewjob?jk=, dropping tracking params', () => {
    const { doc, url } = loadFixture(
      'indeed-jsonld.html',
      'https://www.indeed.com/viewjob?jk=abc123def456&tk=trackingtoken&from=serp',
    );
    const job = indeedExtractor.extract(doc, url);
    expect(job.position).toBe('Backend Engineer');
    expect(job.company).toBe('Acme Robotics');
    expect(job.location).toBe('Makati City, NCR, PH');
    expect(job.jobUrl).toBe('https://www.indeed.com/viewjob?jk=abc123def456');
  });

  it('falls back to DOM selectors and normalizes a /jobs?vjk= search-panel URL to the same shape', () => {
    const { doc, url } = loadFixture('indeed-dom-only.html', 'https://www.indeed.com/jobs?vjk=abc123def456&q=data+analyst');
    const job = indeedExtractor.extract(doc, url);
    expect(job.position).toBe('Data Analyst');
    expect(job.company).toBe('Nimbus Cloud');
    expect(job.location).toBe('Cebu City');
    expect(job.jobUrl).toBe('https://www.indeed.com/viewjob?jk=abc123def456');
  });

  it('leaves location blank instead of throwing when a field is missing from the page', () => {
    const { doc, url } = loadFixture('indeed-missing-location.html', 'https://www.indeed.com/viewjob?jk=zzz999');
    const job = indeedExtractor.extract(doc, url);
    expect(job.position).toBe('Remote Support Specialist');
    expect(job.company).toBe('BrightPath Software');
    expect(job.location).toBe('');
  });

  it('matches indeed country subdomains and viewjob/jobs shapes only', () => {
    expect(indeedExtractor.matches(new URL('https://www.indeed.com/viewjob?jk=1'))).toBe(true);
    expect(indeedExtractor.matches(new URL('https://ph.indeed.com/viewjob?jk=1'))).toBe(true);
    expect(indeedExtractor.matches(new URL('https://www.indeed.com/jobs?vjk=1'))).toBe(true);
    expect(indeedExtractor.matches(new URL('https://www.indeed.com/jobs'))).toBe(false);
    expect(indeedExtractor.matches(new URL('https://www.indeed.com/myjobs'))).toBe(false);
    expect(indeedExtractor.matches(new URL('https://notindeed.com/viewjob?jk=1'))).toBe(false);
  });
});

describe('jobstreet extractor', () => {
  it('prefers JSON-LD when present', () => {
    const { doc, url } = loadFixture('jobstreet-jsonld.html', 'https://www.jobstreet.com.ph/job/12345678?ref=search');
    const job = jobStreetExtractor.extract(doc, url);
    expect(job).toEqual({
      position: 'Frontend Developer',
      company: 'Acme Robotics',
      location: 'Taguig, NCR, PH',
      jobUrl: 'https://www.jobstreet.com.ph/job/12345678',
    });
  });

  it('falls back to data-automation DOM selectors when JSON-LD is absent', () => {
    const { doc, url } = loadFixture('jobstreet-dom-only.html', 'https://www.jobstreet.com.sg/job/87654321?ref=search&utm=1');
    const job = jobStreetExtractor.extract(doc, url);
    expect(job.position).toBe('Warehouse Supervisor');
    expect(job.company).toBe('Nimbus Cloud');
    expect(job.location).toBe('Jurong, Singapore');
    // no canonical link -> falls back to the current URL with query/hash stripped
    expect(job.jobUrl).toBe('https://www.jobstreet.com.sg/job/87654321');
  });

  it('matches known JobStreet market domains and /job/ pages only, not spoofed hosts', () => {
    expect(jobStreetExtractor.matches(new URL('https://www.jobstreet.com.ph/job/1'))).toBe(true);
    expect(jobStreetExtractor.matches(new URL('https://www.jobstreet.com/job/1'))).toBe(true);
    expect(jobStreetExtractor.matches(new URL('https://www.jobstreet.com.ph/'))).toBe(false);
    expect(jobStreetExtractor.matches(new URL('https://jobstreet.com.evil.net/job/1'))).toBe(false);
  });
});

describe('findPlatformForUrl', () => {
  it('routes each real job-board URL to the matching extractor', () => {
    expect(findPlatformForUrl('https://www.linkedin.com/jobs/view/1/')?.id).toBe('linkedin');
    expect(findPlatformForUrl('https://www.indeed.com/viewjob?jk=1')?.id).toBe('indeed');
    expect(findPlatformForUrl('https://www.jobstreet.com.ph/job/1')?.id).toBe('jobstreet');
  });

  it('returns null for an unsupported page instead of throwing', () => {
    expect(findPlatformForUrl('https://example.com/')).toBeNull();
    expect(findPlatformForUrl('not a url')).toBeNull();
  });
});
