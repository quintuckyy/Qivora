import { getSession, clearSession, login, isSessionValid, type StoredUser } from '../services/auth-service';
import { saveApplication, checkDuplicate, type ExistingApplicationSummary } from '../services/applications-service';
import { FRONTEND_URL } from '../services/config';
import { ApiError } from '../services/api-client';
import { emptyJob, type ExtractedJob } from '../platforms/types';
import { PLATFORM_LABELS } from '../platforms';
import type { ExtractJobMessage, ExtractJobResponse } from '../content/content-script';

const app = document.getElementById('app')!;

function escapeHtml(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

async function getActiveTabExtraction(): Promise<ExtractJobResponse> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { supported: false, platform: null, job: null };

  try {
    const message: ExtractJobMessage = { type: 'EXTRACT_JOB' };
    const response = (await chrome.tabs.sendMessage(tab.id, message)) as ExtractJobResponse;
    return response ?? { supported: false, platform: null, job: null };
  } catch {
    // No content script on this tab — not a matching job page, or it hasn't
    // finished injecting yet. Either way, degrade to an empty, editable form.
    return { supported: false, platform: null, job: null };
  }
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
    <p>Use your Job Tracker account to save jobs from here.</p>
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

function renderAlreadySaved(user: StoredUser, application: ExistingApplicationSummary) {
  const savedOn = new Date(application.createdAt).toLocaleDateString();

  app.innerHTML = `
    <div class="footer-row">
      <p>Signed in as ${escapeHtml(user.email)}</p>
      <button type="button" class="btn-link" id="logout-btn">Log out</button>
    </div>
    <div class="card">
      <div class="banner banner-info">Already saved to Job Tracker</div>
      <div>
        <p class="value">${escapeHtml(application.position)}</p>
        <p class="value-sub">${escapeHtml(application.company)} · ${escapeHtml(application.status)} · added ${escapeHtml(savedOn)}</p>
      </div>
      <a href="${escapeHtml(FRONTEND_URL)}/applications/${application.id}" target="_blank" rel="noreferrer">View in Job Tracker ↗</a>
    </div>
  `;

  document.getElementById('logout-btn')!.addEventListener('click', async () => {
    await clearSession();
    await start();
  });
}

interface ReadyOptions {
  user: StoredUser;
  supported: boolean;
  platform: string | null;
  job: ExtractedJob;
  saving?: boolean;
  banner?: { type: 'error' | 'success'; text: string };
  viewLink?: boolean;
}

function renderReady(opts: ReadyOptions) {
  const { user, supported, platform, job, banner, saving, viewLink } = opts;
  const platformLabel = platform ? PLATFORM_LABELS[platform] ?? platform : null;

  app.innerHTML = `
    <div class="footer-row">
      <p>Signed in as ${escapeHtml(user.email)}</p>
      <button type="button" class="btn-link" id="logout-btn">Log out</button>
    </div>
    ${
      supported && platformLabel
        ? `<div class="banner banner-info">Detected: ${escapeHtml(platformLabel)}</div>`
        : `<div class="banner">Open a LinkedIn, Indeed, or JobStreet job posting to auto-fill these fields — you can also fill them in by hand.</div>`
    }
    ${banner ? `<div class="banner ${banner.type === 'error' ? 'banner-error' : 'banner-success'}">${escapeHtml(banner.text)}</div>` : ''}
    ${viewLink ? `<p><a href="${escapeHtml(FRONTEND_URL)}/applications" target="_blank" rel="noreferrer">View in Job Tracker ↗</a></p>` : ''}
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
      <button type="submit" class="btn btn-primary" id="save-btn" ${saving ? 'disabled' : ''}>
        ${saving ? 'Saving…' : 'Save to Job Tracker'}
      </button>
    </form>
  `;

  document.getElementById('logout-btn')!.addEventListener('click', async () => {
    await clearSession();
    await start();
  });

  const form = document.getElementById('save-form') as HTMLFormElement;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nextJob: ExtractedJob = {
      position: (document.getElementById('field-position') as HTMLInputElement).value.trim(),
      company: (document.getElementById('field-company') as HTMLInputElement).value.trim(),
      location: (document.getElementById('field-location') as HTMLInputElement).value.trim(),
      jobUrl: (document.getElementById('field-jobUrl') as HTMLInputElement).value.trim(),
    };

    renderReady({ user, supported, platform, job: nextJob, saving: true });

    const session = await getSession();
    if (!session) {
      renderLogin('Your session expired. Please log in again.');
      return;
    }

    try {
      await saveApplication(nextJob, session.token);
      renderReady({
        user,
        supported,
        platform,
        job: nextJob,
        banner: { type: 'success', text: 'Saved to Job Tracker.' },
        viewLink: true,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearSession();
        renderLogin('Your session expired. Please log in again.');
        return;
      }
      const message = err instanceof ApiError ? err.message : 'Unable to save this application.';
      renderReady({ user, supported, platform, job: nextJob, banner: { type: 'error', text: message } });
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
        renderAlreadySaved(session.user, duplicate.application);
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

  renderReady({ user: session.user, supported: extraction.supported, platform: extraction.platform, job });
}

start();
