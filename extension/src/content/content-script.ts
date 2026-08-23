import { findPlatformForUrl } from '../platforms';
import type { ExtractedJob } from '../platforms/types';

export interface ExtractJobMessage {
  type: 'EXTRACT_JOB';
}

export interface ExtractJobResponse {
  supported: boolean;
  platform: string | null;
  job: Partial<ExtractedJob> | null;
}

function extractCurrentJob(): ExtractJobResponse {
  const platform = findPlatformForUrl(window.location.href);
  if (!platform) return { supported: false, platform: null, job: null };

  const job = platform.extract(document, new URL(window.location.href));
  return { supported: true, platform: platform.id, job };
}

chrome.runtime.onMessage.addListener((message: ExtractJobMessage, _sender, sendResponse) => {
  if (message?.type !== 'EXTRACT_JOB') return undefined;

  // Re-read the DOM on every request rather than caching at script-load
  // time — these are SPAs and can swap the displayed job client-side.
  sendResponse(extractCurrentJob());
  return true;
});
