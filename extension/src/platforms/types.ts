export interface ExtractedJob {
  position: string;
  company: string;
  location: string;
  jobUrl: string;
}

/**
 * One entry per supported job site. `matches(url)` decides whether this
 * platform owns the current page; `extract()` reads the live DOM. Extraction
 * always re-reads the DOM on demand rather than caching at content-script
 * load time, since job sites like LinkedIn are SPAs that can swap the
 * displayed job without a full page navigation.
 */
export interface PlatformExtractor {
  id: string;
  matches(url: URL): boolean;
  extract(doc: Document, url: URL): Partial<ExtractedJob>;
}

export function emptyJob(): ExtractedJob {
  return { position: '', company: '', location: '', jobUrl: '' };
}
