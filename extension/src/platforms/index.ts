import type { PlatformExtractor } from './types';
import { linkedInExtractor } from './linkedin';
import { indeedExtractor } from './indeed';
import { jobStreetExtractor } from './jobstreet';

export type { ExtractedJob, PlatformExtractor } from './types';
export { emptyJob } from './types';

const PLATFORMS: PlatformExtractor[] = [linkedInExtractor, indeedExtractor, jobStreetExtractor];

export const PLATFORM_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  jobstreet: 'JobStreet',
};

export function findPlatformForUrl(href: string): PlatformExtractor | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  return PLATFORMS.find((platform) => platform.matches(url)) ?? null;
}
