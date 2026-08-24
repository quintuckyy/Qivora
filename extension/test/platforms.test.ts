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

  it('parses the newer pipe-separated <title> format ("Position | Company | LinkedIn")', () => {
    const { doc, url } = loadFixture('linkedin-title-pipe-format.html', 'https://www.linkedin.com/jobs/view/9998887776/');
    const job = linkedInExtractor.extract(doc, url);
    expect(job.position).toBe('Full Stack Developer');
    expect(job.company).toBe('Emerson');
  });

  it('recovers location from the "Location · X ago · N applicants" text shape when every class is hashed/auto-generated', () => {
    const { doc, url } = loadFixture('linkedin-hashed-classes.html', 'https://www.linkedin.com/jobs/view/4426607789/');
    const job = linkedInExtractor.extract(doc, url);
    expect(job.position).toBe('Full Stack Developer');
    expect(job.company).toBe('Emerson');
    expect(job.location).toBe('Mandaluyong, National Capital Region, Philippines');
  });

  it('resolves distinct jobUrls for different jobs viewed via the same /jobs/search-results/ panel', () => {
    // Same fixture (no canonical tag, mirroring what a search-results panel
    // actually has) loaded under two different currentJobId values — this
    // is the shape of clicking between jobs in LinkedIn's list+panel view.
    const first = loadFixture(
      'linkedin-hashed-classes.html',
      'https://www.linkedin.com/jobs/search-results/?currentJobId=1111111111',
    );
    const second = loadFixture(
      'linkedin-hashed-classes.html',
      'https://www.linkedin.com/jobs/search-results/?currentJobId=2222222222',
    );

    const firstJob = linkedInExtractor.extract(first.doc, first.url);
    const secondJob = linkedInExtractor.extract(second.doc, second.url);

    expect(firstJob.jobUrl).toBe('https://www.linkedin.com/jobs/view/1111111111/');
    expect(secondJob.jobUrl).toBe('https://www.linkedin.com/jobs/view/2222222222/');
    expect(firstJob.jobUrl).not.toBe(secondJob.jobUrl);
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

  it('matches indeed country subdomains wherever a job panel is open (jk/vjk present), regardless of path', () => {
    expect(indeedExtractor.matches(new URL('https://www.indeed.com/viewjob?jk=1'))).toBe(true);
    expect(indeedExtractor.matches(new URL('https://ph.indeed.com/viewjob?jk=1'))).toBe(true);
    expect(indeedExtractor.matches(new URL('https://www.indeed.com/jobs?vjk=1'))).toBe(true);
    // The homepage can also show a job detail panel (e.g. "Jobs for you").
    expect(indeedExtractor.matches(new URL('https://ph.indeed.com/?from=gnav-homepage&vjk=1'))).toBe(true);
    expect(indeedExtractor.matches(new URL('https://www.indeed.com/jobs'))).toBe(false);
    expect(indeedExtractor.matches(new URL('https://www.indeed.com/'))).toBe(false);
    expect(indeedExtractor.matches(new URL('https://notindeed.com/viewjob?jk=1'))).toBe(false);
  });

  it('trusts the live jk/vjk param over a canonical tag that may be stale from the panel\'s initial load', () => {
    const { doc, url } = loadFixture(
      'indeed-stale-canonical.html',
      'https://www.indeed.com/?from=gnav-homepage&vjk=freshjobkey111',
    );
    const job = indeedExtractor.extract(doc, url);
    expect(job.jobUrl).toBe('https://www.indeed.com/viewjob?jk=freshjobkey111');
  });

  it('strips the visually-hidden "- job post" a11y suffix from the title, and splits a squished location', () => {
    const { doc, url } = loadFixture('indeed-job-post-label.html', 'https://ph.indeed.com/viewjob?jk=c351bb01565');
    const job = indeedExtractor.extract(doc, url);
    expect(job.position).toBe('Full Stack Artificial Intelligence (AI) Engineer');
    expect(job.company).toBe('Elgada BPO Solutions Inc.');
    expect(job.location).toBe('Makati');
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
    // The apply flow (résumé selection, screening questions) lives under
    // /job/<id>/apply — still a real job page, just a different sub-view.
    expect(jobStreetExtractor.matches(new URL('https://ph.jobstreet.com/job/93633215/apply?sol=abc'))).toBe(true);
  });

  it('recovers position/company from the "Applying for" summary card on the /apply flow, where document.title is just the wizard step', () => {
    const { doc, url } = loadFixture(
      'jobstreet-apply-flow.html',
      'https://ph.jobstreet.com/job/93633215/apply?sol=59102f1c07e0e4f558f46e8365e50f411fcdfcb9',
    );
    const job = jobStreetExtractor.extract(doc, url);
    expect(job.position).toBe('Developer / Programmer');
    expect(job.company).toBe('SAN MIGUEL HOLDINGS CORP.');
    expect(job.jobUrl).toBe('https://ph.jobstreet.com/job/93633215/apply');
  });

  it('detects a job panel on the homepage (no URL signal at all) via the DOM, when a document is provided', () => {
    const { doc, url } = loadFixture('jobstreet-homepage-panel.html', 'https://ph.jobstreet.com/');
    expect(jobStreetExtractor.matches(url)).toBe(false); // URL alone: no /job/ path, no doc -> not detected
    expect(jobStreetExtractor.matches(url, doc)).toBe(true); // with doc: job panel found in the DOM
  });

  it('extracts a homepage job panel and resolves jobUrl from the panel\'s own title link, not the address bar', () => {
    const { doc, url } = loadFixture('jobstreet-homepage-panel.html', 'https://ph.jobstreet.com/');
    const job = jobStreetExtractor.extract(doc, url);
    expect(job.position).toBe('IT Helpdesk (Perm WFH/Morning Shift)');
    expect(job.company).toBe('HGS Offshore Staffing Solutions');
    expect(job.location).toBe('Metro Manila (Remote)');
    expect(job.jobUrl).toBe('https://ph.jobstreet.com/job/93959933');
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

  it('passes the document through so DOM-only detection (JobStreet homepage panel) works end to end', () => {
    const { doc } = loadFixture('jobstreet-homepage-panel.html', 'https://ph.jobstreet.com/');
    expect(findPlatformForUrl('https://ph.jobstreet.com/')).toBeNull();
    expect(findPlatformForUrl('https://ph.jobstreet.com/', doc)?.id).toBe('jobstreet');
  });
});
