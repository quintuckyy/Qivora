import type { PlatformExtractor } from './types';
import { linkedInExtractor } from './linkedin';

export type { ExtractedJob, PlatformExtractor } from './types';
export { emptyJob } from './types';

// Add Indeed/JobStreet extractors here later — each is a self-contained
// module exporting a PlatformExtractor, same shape as linkedin.ts.
const PLATFORMS: PlatformExtractor[] = [linkedInExtractor];

export function findPlatformForUrl(href: string): PlatformExtractor | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  return PLATFORMS.find((platform) => platform.matches(url)) ?? null;
}
