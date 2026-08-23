# Job Tracker — LinkedIn Companion

A Chrome/Edge (Manifest V3) browser extension that saves a job posting from
LinkedIn straight into the [Job Application Tracker](../) API, without
switching tabs to fill in the form by hand.

## How it works

- **Content script** (`src/content/content-script.ts`) runs on
  `linkedin.com/jobs/*` pages. On request, it reads the current job posting
  and returns whatever it finds — it never pushes data on its own.
- **Platform extractors** (`src/platforms/`) hold the site-specific parsing.
  `linkedin.ts` is the only one today; adding Indeed or JobStreet later means
  writing one new file with the same `PlatformExtractor` shape and registering
  it in `src/platforms/index.ts` — nothing else in the extension needs to
  change.
- **Popup** (`src/popup/`) is the UI: it asks the content script for whatever
  it detected, shows the fields pre-filled and editable, and calls the
  tracker's own API to save.
- **Services** (`src/services/`) wrap the API: `auth-service.ts` for
  login/session, `applications-service.ts` for the actual save.

### LinkedIn extraction strategy

In priority order:
1. **JSON-LD structured data** (`<script type="application/ld+json">`,
   `@type: "JobPosting"`) — job boards emit this for SEO, and it's far less
   brittle than scraping visual DOM classes that change with every redesign.
2. **DOM selectors** — a handful of candidate class names for the title,
   company, and location, tried in order.
3. **`<title>` tag parsing** — last resort, since LinkedIn job page titles
   are usually `"Job Title hiring at Company | LinkedIn"`.

Nothing is ever required — any field the extractor can't find is left blank
and editable, so the popup is still fully usable if LinkedIn's markup drifts.

### Auth

The extension **cannot read the web app's session** — `localStorage` is
scoped per-origin, and a browser extension is a different origin from
`localhost:5173`, by design, for security. So the popup has its own login
form, calling the same `POST /auth/login` the web app uses, and keeps its
token in `chrome.storage.local` (extension-private storage — never reachable
by any web page, including LinkedIn). Same account, same backend, same
tokens — just a separate session, which is the standard pattern real
"save to X" extensions use.

`GET /protected` (an existing route on the API) is used to check a stored
token is still valid when the popup opens, so an expired session shows the
login form again instead of failing silently on save.

## Setup

```bash
cd extension
npm install
cp .env.example .env   # adjust VITE_API_BASE_URL / VITE_FRONTEND_URL if needed
npm run build
```

This produces `extension/dist/` — a loadable unpacked extension:

1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. **Load unpacked** → select `extension/dist`
4. Open a LinkedIn job posting (`linkedin.com/jobs/view/...`) and click the
   extension icon

`npm run dev` rebuilds the popup on change (`--watch`); reload the extension
in `chrome://extensions` and refresh the LinkedIn tab to pick up content
script changes (Chrome doesn't hot-reload extensions).

## Configuration

`VITE_API_BASE_URL` and `VITE_FRONTEND_URL` are baked into the bundle at
build time (same convention the main frontend uses). If you change
`VITE_API_BASE_URL` to point somewhere other than `localhost:3000`, update
`manifest.json`'s `host_permissions` to match, or the popup's `fetch` calls
will be blocked.

## Verification performed

- `npm run build` (via `npm run build` in this repo) compiles clean and
  produces `manifest.json` + `popup.html/js/css` + `content.js` in `dist/`.
- The LinkedIn extractor was tested against a **synthetic fixture** — a local
  HTML page shaped like a LinkedIn job posting (JSON-LD block + matching DOM),
  served under a mocked `https://www.linkedin.com/...` URL — for both the
  JSON-LD path and the DOM-fallback path (JSON-LD stripped). Both correctly
  recovered position, company, location, and job URL.
- The full **login → save → appears in the web app** path was exercised
  against the real running backend and frontend: logged in via
  `POST /auth/login`, saved via `POST /applications` with the exact payload
  shape the popup sends (`status: "APPLIED"` included), and confirmed the
  application rendered in the web app's Applications list.

## Known limitations

- **Not tested against the real linkedin.com.** This environment has no
  general internet access, so the DOM selectors in `src/platforms/linkedin.ts`
  are based on documented/known LinkedIn markup conventions, not a live
  capture. The JSON-LD path is the more durable one and is tried first for
  exactly this reason, but **please open a real LinkedIn job page and check
  the popup fills in correctly** before relying on it — if a selector is
  stale, it's a one-file fix (`src/platforms/linkedin.ts`), and the field
  just needs typing in by hand as a fallback either way.
- **The actual packed extension wasn't loaded into a real browser** in this
  session (no interactive browser UI available here) — the popup's
  login/save flow was verified by exercising the same API calls it makes,
  not by clicking through the extension itself. `chrome.storage`,
  `chrome.tabs.sendMessage`, and the host_permissions-based CORS bypass are
  all standard, documented MV3 behavior, but please do the manual pass
  described above before treating this as done.
- **No icons.** `manifest.json` omits `icons`/`action.default_icon`, so
  Chrome shows a generic default icon in the toolbar. Cosmetic only.
- Extraction only covers `linkedin.com/jobs/view/*`-style pages. LinkedIn's
  job **search results** view (a list with a preview panel, no dedicated
  `/jobs/view/` URL) isn't specifically handled — open the full job posting
  first.
- Salary isn't extracted (LinkedIn shows it inconsistently); the popup only
  covers the four required fields — position, company, location, job URL.
- No Chrome Web Store packaging/signing — this is a developer-mode "load
  unpacked" extension only.
