import { getSession, clearSession, login, isSessionValid, type StoredUser } from '../services/auth-service';
import {
  saveApplication,
  checkDuplicate,
  type ExistingApplicationSummary,
  type CreatedApplication,
} from '../services/applications-service';
import { FRONTEND_URL } from '../services/config';
import { ApiError } from '../services/api-client';
import { emptyJob, type ExtractedJob } from '../platforms/types';
import type { ExtractJobMessage, ExtractJobResponse } from '../content/content-script';

const app = document.getElementById('app')!;

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

/** Circular check, right-aligned in the saved card as the "this is in Qivora" cue. */
const SAVED_CHECK = `
  <svg class="saved-check" viewBox="0 0 24 24" role="img" aria-label="Saved">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.16" />
    <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" />
  </svg>
`;

/** Declarative content_scripts alone miss two common cases: a tab that was
 * already open before the extension loaded, and a same-page SPA navigation
 * (LinkedIn/Indeed/JobStreet are all client-side routed) that never fires a
 * fresh document load. Re-injecting on every popup open — safe/idempotent,
 * see the guard in content-script.ts — fixes both without needing the user
 * to refresh the tab first. */
async function ensureContentScriptInjected(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch {
    // Fails for pages the extension can't script (chrome://, the Web Store,
    // etc.) — the sendMessage attempt below will then fail too and we
    // correctly fall back to the empty, editable form.
  }
}

function isIncomplete(job: Partial<ExtractedJob> | null): boolean {
  return !job || !job.position || !job.company || !job.location;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getActiveTabExtraction(): Promise<ExtractJobResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { supported: false, platform: null, job: null };
  const tabId = tab.id;

  await ensureContentScriptInjected(tabId);

  async function attempt(): Promise<ExtractJobResponse> {
    try {
      const message: ExtractJobMessage = { type: 'EXTRACT_JOB' };
      const response = (await chrome.tabs.sendMessage(tabId, message)) as ExtractJobResponse;
      return response ?? { supported: false, platform: null, job: null };
    } catch {
      // Nothing listening (truly unsupported page) — degrade to an empty,
      // editable form.
      return { supported: false, platform: null, job: null };
    }
  }

  let result = await attempt();

  // These sites render the job-details panel asynchronously after a route
  // change, and the page <title> often updates before that panel's DOM
  // does — so a first attempt right when the popup opens can catch
  // position/company from the <title> fallback while the real DOM nodes
  // (especially location) are still empty. A couple of short retries covers
  // that without making the popup feel slow on the common case where
  // everything was already there.
  for (let i = 0; i < 3 && result.supported && isIncomplete(result.job); i++) {
    await sleep(350);
    result = await attempt();
  }

  return result;
}

function renderLoading(message = 'Checking your session…') {
  app.innerHTML = `
    <div class="row">
      <span class="spinner"></span>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

function renderLogin(error?: string) {
  app.innerHTML = `
    <h2>Log in</h2>
    <p>Use your Qivora account to save jobs straight from the posting.</p>
    ${error ? `<div class="banner banner-error">${escapeHtml(error)}</div>` : ''}
    <form id="login-form" class="card">
      <label class="field">
        <span>Email</span>
        <input type="email" id="login-email" required autocomplete="email" />
      </label>
      <label class="field">
        <span>Password</span>
        <input type="password" id="login-password" required autocomplete="current-password" />
      </label>
      <button type="submit" class="btn btn-primary" id="login-submit">Log in</button>
    </form>
  `;

  const form = document.getElementById('login-form') as HTMLFormElement;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = (document.getElementById('login-email') as HTMLInputElement).value;
    const password = (document.getElementById('login-password') as HTMLInputElement).value;
    const submitBtn = document.getElementById('login-submit') as HTMLButtonElement;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    try {
      await login(email, password);
      await start();
    } catch (err) {
      renderLogin(err instanceof ApiError ? err.message : 'Unable to log in. Please try again.');
    }
  });
}

function renderSavedCard(
  application: { id: string; position: string; company: string; status: string },
  subline: string,
) {
  app.innerHTML = `
    <div class="card saved-card">
      <div class="saved-main">
        <div class="saved-info">
          <p class="value">${escapeHtml(application.position)}</p>
          <p class="value-sub">${escapeHtml(subline)}</p>
        </div>
        ${SAVED_CHECK}
      </div>
      <a class="btn btn-primary saved-link" href="${escapeHtml(FRONTEND_URL)}/applications/${application.id}" target="_blank" rel="noreferrer">View in Qivora ↗</a>
    </div>
  `;
}

function renderSaved(application: CreatedApplication) {
  renderSavedCard(application, `${application.company} · ${application.status}`);
}

function renderAlreadySaved(application: ExistingApplicationSummary) {
  const savedOn = new Date(application.createdAt).toLocaleDateString();
  renderSavedCard(application, `${application.company} · ${application.status} · added ${savedOn}`);
}

interface ReadyOptions {
  user: StoredUser;
  supported: boolean;
  job: ExtractedJob;
  saving?: boolean;
  errorText?: string;
}

function renderReady(opts: ReadyOptions) {
  const { user, supported, job, errorText, saving } = opts;

  app.innerHTML = `
    ${
      supported
        ? ''
        : `<div class="banner">Open a LinkedIn, Indeed, or JobStreet job posting to auto-fill these fields — you can also fill them in by hand.</div>`
    }
    ${errorText ? `<div class="banner banner-error">${escapeHtml(errorText)}</div>` : ''}
    <form id="save-form" class="card">
      <label class="field">
        <span>Position</span>
        <input id="field-position" required value="${escapeHtml(job.position)}" />
      </label>
      <label class="field">
        <span>Company</span>
        <input id="field-company" required value="${escapeHtml(job.company)}" />
      </label>
      <label class="field">
        <span>Location</span>
        <input id="field-location" value="${escapeHtml(job.location)}" />
      </label>
      <label class="field">
        <span>Job URL</span>
        <input id="field-jobUrl" type="url" value="${escapeHtml(job.jobUrl)}" />
      </label>
      <div class="field-row">
        <label class="field">
          <span>Salary Min</span>
          <input id="field-salaryMin" type="number" min="0" value="${job.salaryMin ?? ''}" />
        </label>
        <label class="field">
          <span>Salary Max</span>
          <input id="field-salaryMax" type="number" min="0" value="${job.salaryMax ?? ''}" />
        </label>
      </div>
      <button type="submit" class="btn btn-primary" id="save-btn" ${saving ? 'disabled' : ''}>
        ${saving ? 'Saving…' : 'Save to Qivora'}
      </button>
    </form>
  `;

  const form = document.getElementById('save-form') as HTMLFormElement;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const salaryMinRaw = (document.getElementById('field-salaryMin') as HTMLInputElement).value.trim();
    const salaryMaxRaw = (document.getElementById('field-salaryMax') as HTMLInputElement).value.trim();

    const nextJob: ExtractedJob = {
      position: (document.getElementById('field-position') as HTMLInputElement).value.trim(),
      company: (document.getElementById('field-company') as HTMLInputElement).value.trim(),
      location: (document.getElementById('field-location') as HTMLInputElement).value.trim(),
      jobUrl: (document.getElementById('field-jobUrl') as HTMLInputElement).value.trim(),
      salaryMin: salaryMinRaw ? Number(salaryMinRaw) : undefined,
      salaryMax: salaryMaxRaw ? Number(salaryMaxRaw) : undefined,
    };

    renderReady({ user, supported, job: nextJob, saving: true });

    const session = await getSession();
    if (!session) {
      renderLogin('Your session expired. Please log in again.');
      return;
    }

    try {
      const created = await saveApplication(nextJob, session.token);
      renderSaved(created);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearSession();
        renderLogin('Your session expired. Please log in again.');
        return;
      }
      const message = err instanceof ApiError ? err.message : 'Unable to save this application.';
      renderReady({ user, supported, job: nextJob, errorText: message });
    }
  });
}

async function start() {
  renderLoading();

  const session = await getSession();
  if (!session) {
    renderLogin();
    return;
  }

  const valid = await isSessionValid(session.token);
  if (!valid) {
    await clearSession();
    renderLogin('Your session expired. Please log in again.');
    return;
  }

  renderLoading('Reading the job posting…');
  const extraction = await getActiveTabExtraction();
  const job: ExtractedJob = { ...emptyJob(), ...extraction.job };

  // Checked up front (not just on submit) so a duplicate never even shows a
  // fillable save form — the clearest way to keep from creating a second record.
  if (job.jobUrl) {
    renderLoading('Checking if this job is already saved…');
    try {
      const duplicate = await checkDuplicate(job.jobUrl, session.token);
      if (duplicate.exists && duplicate.application) {
        renderAlreadySaved(duplicate.application);
        return;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearSession();
        renderLogin('Your session expired. Please log in again.');
        return;
      }
      // Any other failure (offline, 5xx) shouldn't block saving — fall
      // through to the normal form; save will surface the error if it recurs.
    }
  }

  renderReady({ user: session.user, supported: extraction.supported, job });
}

start();
