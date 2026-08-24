export interface ExtractedJob {
  position: string;
  company: string;
  location: string;
  jobUrl: string;
}

/**
 * One entry per supported job site. `matches(url, doc?)` decides whether
 * this platform owns the current page; `extract()` reads the live DOM.
 * Extraction always re-reads the DOM on demand rather than caching at
 * content-script load time, since job sites like LinkedIn are SPAs that can
 * swap the displayed job without a full page navigation. `doc` is optional
 * on `matches` for platforms whose URL alone is enough to decide (most of
 * them) — it exists for pages like a job board's homepage or search
 * results, where the URL never reflects which job is open in a panel at
 * all, so the only way to detect one is present is to look at the DOM.
 * Content-script call sites always pass it; unit tests that only care about
 * the URL-based checks can omit it.
 */
export interface PlatformExtractor {
  id: string;
  matches(url: URL, doc?: Document): boolean;
  extract(doc: Document, url: URL): Partial<ExtractedJob>;
}

export function emptyJob(): ExtractedJob {
  return { position: '', company: '', location: '', jobUrl: '' };
}
