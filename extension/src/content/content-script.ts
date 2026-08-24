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
  const platform = findPlatformForUrl(window.location.href, document);
  if (!platform) return { supported: false, platform: null, job: null };

  const job = platform.extract(document, new URL(window.location.href));
  return { supported: true, platform: platform.id, job };
}

declare global {
  interface Window {
    __jobTrackerContentScriptLoaded?: boolean;
  }
}

// The popup injects this script on demand via chrome.scripting.executeScript
// before every extraction request (see getActiveTabExtraction in popup.ts) —
// declarative content_scripts alone miss tabs that were already open before
// the extension loaded, and SPA route changes (LinkedIn/Indeed/JobStreet are
// all client-side routed) that never trigger a fresh document load. Injection
// can therefore happen more than once per page, so guard against registering
// the listener twice.
if (!window.__jobTrackerContentScriptLoaded) {
  window.__jobTrackerContentScriptLoaded = true;

  chrome.runtime.onMessage.addListener((message: ExtractJobMessage, _sender, sendResponse) => {
    if (message?.type !== 'EXTRACT_JOB') return undefined;

    // Re-read the DOM on every request rather than caching at script-load
    // time — these are SPAs and can swap the displayed job client-side.
    sendResponse(extractCurrentJob());
    return true;
  });
}
