# Job Tracker — Job Board Companion

A Chrome/Edge (Manifest V3) browser extension that saves a job posting from
**LinkedIn, Indeed, or JobStreet** straight into the
[Job Application Tracker](../) API, without switching tabs to fill in the
form by hand. It also checks whether the job is already saved and shows an
"Already saved" state instead of creating a duplicate.

## How it works

- **Content script** (`src/content/content-script.ts`) runs only on the
  job-view pages listed in `manifest.json`'s `content_scripts.matches` (never
  on a site's private dashboard/application-history pages). On request, it
  reads the current job posting and returns whatever it finds — it never
  pushes data on its own.
- **Platform extractors** (`src/platforms/`) hold the site-specific parsing:
  `linkedin.ts`, `indeed.ts`, `jobstreet.ts`, each exporting a
  `PlatformExtractor` with the same shape (`id`, `matches(url)`,
  `extract(doc, url)`). `shared.ts` holds the *generic*, non-selector-specific
  helpers all three reuse (JSON-LD parsing, text cleanup, safe hostname
  matching) — the actual CSS selectors live only in each platform's own file,
  so tuning one site's markup never touches another's. `index.ts` registers
  all three in `PLATFORMS` and picks the first whose `matches(url)` returns
  true; adding a fourth site later is one new file plus one line there.
- **Popup** (`src/popup/`) is the UI: it asks the content script for whatever
  it detected, shows which platform was recognized, shows the fields
  pre-filled and editable, checks for a duplicate, and calls the tracker's
  own API to save.
- **Services** (`src/services/`) wrap the API: `auth-service.ts` for
  login/session, `applications-service.ts` for saving and for the
  duplicate check.

### Extraction strategy (all three platforms)

In priority order:
1. **JSON-LD structured data** (`<script type="application/ld+json">`,
   `@type: "JobPosting"`) — job boards emit this for SEO, and it's far less
   brittle than scraping visual DOM classes that change with every redesign.
   Parsed once, generically, in `shared.ts`.
2. **DOM selectors** — a handful of candidate selectors per field, tried in
   order, specific to each site's known markup conventions.
3. **`<title>` tag parsing** — last resort, since each site's job page title
   follows a predictable "Title - Company - ..." or "Title hiring at Company"
   shape.

Nothing is ever required — any field an extractor can't find is left blank
and editable, so the popup is still fully usable if a site's markup drifts,
and a completely unsupported page just shows the plain "fill in by hand" form
instead of failing.

### Job URL — the trickiest part, per platform

Job URL doubles as the duplicate-detection key, so getting it consistent
matters more than for the other fields:

- **LinkedIn / JobStreet** — the job id lives in the URL *path*
  (`/jobs/view/<id>/`, `/job/<id>`), so the canonical `<link>` tag if present,
  else the current URL with query string and hash stripped, is a stable id.
- **Indeed** — the job id is the `jk` query parameter itself (`/viewjob?jk=…`
  or the search-results panel's `/jobs?vjk=…`). Stripping the query string
  here would destroy the id, so `indeed.ts` reads `jk`/`vjk` explicitly and
  normalizes both URL shapes to the same `/viewjob?jk=…` form — visiting the
  same job from a search-results panel or its direct page both dedup to the
  same saved record.

### Platform detection safety

`matches(url)` for every extractor checks the hostname against an explicit
known-domain list (`endsWith('.linkedin.com')`-style, dot-bounded), not a
loose substring check — so a lookalike host like `evillinkedin.com` or
`jobstreet.com.evil.net` is correctly rejected rather than treated as the
real site. Covered by `test/platforms.test.ts`.

### Auth

The extension **cannot read the web app's session** — `localStorage` is
scoped per-origin, and a browser extension is a different origin from
`localhost:5173`, by design, for security. So the popup has its own login
form, calling the same `POST /auth/login` the web app uses, and keeps its
token in `chrome.storage.local` (extension-private storage — never reachable
by any web page, including the job boards themselves). Same account, same
backend, same tokens — just a separate session, which is the standard
pattern real "save to X" extensions use. No job-board credentials are ever
touched or stored.

`GET /protected` (an existing route on the API) is used to check a stored
token is still valid when the popup opens, so an expired session shows the
login form again instead of failing silently on save.

The popup calls the API from its `chrome-extension://<id>` origin, so the
backend's CORS allowlist has to accept it. `backend/src/main.ts` allows any
`chrome-extension://` origin outside production (the unpacked id changes on
every reload); for a production deployment, add the published extension's
`chrome-extension://<id>` origin to `FRONTEND_ORIGIN`.

### Duplicate detection

Before showing the editable save form, the popup calls
`GET /applications/check-duplicate?jobUrl=…` (scoped server-side to the
signed-in user). If that job URL is already saved, it shows an "Already
saved" card with a link into the web app instead of the form — this applies
to all three platforms equally, since it keys off the normalized `jobUrl`
each extractor produces, not anything platform-specific.

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
4. Open a LinkedIn, Indeed, or JobStreet job posting and click the
   extension icon

`npm run dev` rebuilds the popup on change (`--watch`); reload the extension
in `chrome://extensions` and refresh the job-board tab to pick up content
script changes (Chrome doesn't hot-reload extensions).

## Configuration

`VITE_API_BASE_URL` and `VITE_FRONTEND_URL` are baked into the bundle at
build time (same convention the main frontend uses). If you change
`VITE_API_BASE_URL` to point somewhere other than `localhost:3000`, update
`manifest.json`'s `host_permissions` to match, or the popup's `fetch` calls
will be blocked.

## Testing

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run — fixture-based extraction tests
npm run build       # production bundle
```

`test/platforms.test.ts` runs every extractor against realistic HTML
fixtures in `test/fixtures/` (via `jsdom`) covering, per platform: the
JSON-LD path, the DOM-selector fallback path, a missing-field case (proving
extraction degrades gracefully instead of throwing), and the hostname
spoofing-safety checks. This is fixture-based rather than a live capture —
see **Known limitations**.

## Known limitations

- **Not verified against the real live sites.** This environment has no
  general internet access, so the DOM selectors in `src/platforms/*.ts` are
  based on documented/known markup conventions for each site (LinkedIn's
  `job-details-jobs-unified-top-card__*` classes, Indeed's
  `data-testid="jobsearch-*"` attributes, JobStreet/SEEK's
  `data-automation="*"` attributes), not a live capture, and are exercised
  here only against realistic synthetic fixtures. The JSON-LD path is the
  more durable one and is tried first for exactly this reason, but **please
  open a real job posting on each site and check the popup fills in
  correctly** before relying on it — if a selector is stale, it's a one-file
  fix (that platform's file only), and the field just needs typing in by
  hand as a fallback either way.
- **Indeed** search-results-panel pages (`/jobs?vjk=…`) are supported, but
  Indeed's mobile site and any A/B-tested layout variants are not
  specifically accounted for — the title-tag fallback should still recover
  position/company/location in most cases.
- **JobStreet** ships one storefront per country on a different ccTLD, and
  this extension's `JOBSTREET_HOSTS` list (`jobstreet.com`, `.com.ph`,
  `.com.sg`, `.co.id`) covers only the more common ones. A market not in
  that list (e.g. `jobstreet.com.my` if still live under that domain, or a
  future SEEK-branded rename) needs one line added to
  `src/platforms/jobstreet.ts` and a matching entry in `manifest.json`'s
  `host_permissions`/`content_scripts.matches` — nothing else changes.
- **The actual packed extension wasn't loaded into a real browser** in this
  session (no interactive browser UI available here) — the popup's
  login/save/duplicate-check flow was verified by exercising the same API
  calls it makes against the real running backend, not by clicking through
  the extension itself. `chrome.storage` and `chrome.tabs.sendMessage` are
  standard, documented MV3 behavior, but please do the manual pass described
  above before treating multi-platform support as fully done.
- **The toolbar icon is a downscale of the 330×330 Qivora mark**
  (`src/popup/icon-128.png`), declared for every size slot. Chrome scales it
  per context; hand-tuned 16/32 px exports would be crisper but aren't
  generated here.
- Extraction only covers a single job-posting page per platform (LinkedIn
  `/jobs/view/*`, Indeed `/viewjob` and `/jobs?vjk=`, JobStreet `/job/*`) —
  none of the three platforms' search/listing pages are scraped in bulk.
- Salary isn't extracted on any platform; the popup only covers the four
  required fields — position, company, location, job URL.
- No Chrome Web Store packaging/signing — this is a developer-mode "load
  unpacked" extension only.
