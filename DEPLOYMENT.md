# Deploying Qivora

Qivora is three services — a NestJS API, a static React SPA served by nginx, and
PostgreSQL — wired together by Docker Compose. The browser extension is built
and distributed separately (see [extension/README.md](extension/README.md)).

This document covers a **single-host production deployment**. Read
[Limitations](#limitations) first — some of them are hard constraints on how far
this setup scales.

---

## 1. What "production" changes

| Concern | Development | Production |
|---|---|---|
| Compose files | `docker-compose.yml` + auto-loaded `docker-compose.override.yml` | `docker-compose.yml` + `docker-compose.prod.yml` (override NOT loaded) |
| Postgres host port | published on `127.0.0.1:5432` | **not published** — internal network only |
| CORS | any origin allowed when `FRONTEND_ORIGIN` unset; any `chrome-extension://` allowed | only the exact origins in `FRONTEND_ORIGIN` |
| Swagger UI (`/api/docs`) | served | **off** (`ENABLE_SWAGGER=false`) |
| Rate limiting | on (tests opt out with `THROTTLE_ENABLED=false`) | on |
| Secrets | dev placeholders tolerated | every secret **required**, compose fails fast if missing |
| `NODE_ENV` | unset | `production` |

`NODE_ENV=production`, `ENABLE_SWAGGER=false`, and the required-secret checks all
come from `docker-compose.prod.yml`; you don't set them by hand.

---

## 2. Prerequisites

- A host with Docker + Docker Compose v2.
- A domain (or two) pointing at the host.
- **A TLS-terminating reverse proxy or platform load balancer in front of the
  containers** — see [TLS](#3-tls-required). The compose stack itself only
  speaks plain HTTP.
- SMTP sender (Brevo) and Google OAuth client only if you want password-reset
  emails / Gmail sync / Google sign-in — all optional.

---

## 3. TLS (required)

The `frontend` container listens on `:80` and the `backend` on `:3000`, both
plain HTTP. **Do not expose those ports to the internet directly.** Put one of
these in front:

- **Platform LB** (Fly, Render, Railway, an ALB, …) terminating TLS and
  forwarding to the container ports, or
- **Caddy / Traefik / nginx + certbot** on the same host, terminating TLS and
  reverse-proxying `https://app.example.com → frontend:80` and
  `https://api.example.com → backend:3000`.

Whatever terminates TLS must forward the browser's real `Host`/`Origin` and set
`X-Forwarded-Proto: https`. HSTS is emitted by the app (via helmet) once it sees
HTTPS.

---

## 4. Production environment variables

Copy `.env.example` to `.env` at the repo root and fill it in. `docker compose`
reads `.env` automatically.

### Required

| Variable | Notes |
|---|---|
| `JWT_SECRET` | `openssl rand -base64 48`. Fresh — never the dev value. Rotating it logs everyone out. |
| `POSTGRES_PASSWORD` | `openssl rand -base64 24`. |
| `FRONTEND_ORIGIN` | Comma-separated browser-origin allowlist. Deployed web app origin, plus the published extension origin if you ship it (see [CORS](#6-cors)). |
| `VITE_API_BASE_URL` | Public backend URL the browser calls, e.g. `https://api.example.com`. **Baked into the SPA at image build time** — rebuild the `frontend` image to change it. |

### Required only if the matching optional feature is enabled

| Variable | Enables | Notes |
|---|---|---|
| `EMAIL_SYNC_ENCRYPTION_KEY` | Gmail sync | `openssl rand -base64 32`. Encrypts stored Gmail tokens (AES-256-GCM). Changing it forces every user to reconnect Gmail. |
| `GOOGLE_CLIENT_ID` | Gmail sync + "Continue with Google" | Not a secret. Use a **separate** OAuth client from local dev. |
| `GOOGLE_CLIENT_SECRET` | Gmail sync | Real secret. Inject via secret manager; rotate in Google Cloud Console if leaked. |
| `GOOGLE_OAUTH_REDIRECT_URI` | Gmail sync | Must exactly match an authorized redirect URI on the OAuth client, pointing at `https://<frontend>/email-sync`. |
| `VITE_GOOGLE_CLIENT_ID` | "Continue with Google" button | Same value as `GOOGLE_CLIENT_ID`. Baked into the SPA at build time. |
| `BREVO_API_KEY` | Password-reset email | Real secret. Scope it to transactional email only. Without it, reset links are logged instead of emailed. |
| `MAIL_FROM` | Password-reset email | A Brevo-verified sender. |

### Optional tuning

| Variable | Default | Notes |
|---|---|---|
| `JWT_EXPIRES_IN` | `1d` | |
| `BACKEND_PORT` / `FRONTEND_PORT` | `3000` / `5173` | Host ports the reverse proxy targets. |
| `ENABLE_SWAGGER` | off in prod | `true` re-enables `/api/docs`. Leave off. |
| `THROTTLE_ENABLED` | on | **Never** set to `false` in production. It exists for the test suites. |

Secrets: keep them in a root-only `.env` (`chmod 600`) or your host's secret
manager. Never bake them into an image, never commit them.

---

## 5. Deploy

```bash
# 1. Clone and configure
git clone <repo> && cd job-application-tracker
cp .env.example .env
$EDITOR .env                       # fill in every "REQUIRED IN PROD" value

# 2. Build + start (migrations run automatically on backend startup)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 3. Verify
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
curl -fsS http://localhost:${BACKEND_PORT:-3000}/health   # {"status":"ok","database":"connected"}
```

Then point the reverse proxy at `frontend` (`:80` / `FRONTEND_PORT`) and
`backend` (`:3000` / `BACKEND_PORT`) and confirm `https://app.example.com`
loads and can register + log in.

**Database migrations** run on every backend container start
(`prisma migrate deploy` in `docker-entrypoint.sh`). Deploying a new image with
new migrations applies them automatically; there is no separate migration step.

### Updating

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Changing `VITE_API_BASE_URL` or `VITE_GOOGLE_CLIENT_ID` requires
`--build` (they're compiled into the SPA bundle).

---

## 6. CORS

The API's allowlist is `FRONTEND_ORIGIN` (comma-separated). In production nothing
else gets through.

- **Web app origin** — e.g. `https://app.example.com`. Scheme + host + port, no
  path, no trailing slash.
- **Published browser extension** — its origin is `chrome-extension://<id>`,
  where `<id>` is the 32-char id the Chrome Web Store assigns (stable once
  published; visible on `chrome://extensions`). Add it:

  ```
  FRONTEND_ORIGIN=https://app.example.com,chrome-extension://abcdefghijklmnopabcdefghijklmnop
  ```

  The dev-time "allow any `chrome-extension://`" shortcut is disabled under
  `NODE_ENV=production` — an unlisted extension origin is rejected.

Requests with no `Origin` header (server-to-server, curl, health checks) are
always allowed; CORS is a browser-only protection.

Logic lives in `backend/src/config/cors.ts` and is covered by
`backend/src/config/cors.spec.ts`.

---

## 7. Rate limiting

Per-client-IP limits (`backend/src/config/throttling.ts`):

| Scope | Limit |
|---|---|
| Every route (baseline) | 300 / 60s |
| `/auth/*` (login, register, google, reset-password) | 10 / 60s |
| `/auth/forgot-password` | 5 / 15min |

Exceeding a limit returns `429 Too Many Requests`. The store is in-memory
(per backend instance) — see [Limitations](#limitations).

If the reverse proxy is the only thing the backend sees, make sure it forwards
the client IP (`X-Forwarded-For`) or every request will share one bucket.

---

## 8. Verification checklist

After deploy:

- [ ] `GET /health` returns `{"status":"ok","database":"connected"}`
- [ ] `https://app.example.com` loads over HTTPS; HTTP redirects to HTTPS
- [ ] Register a throwaway account, log in, create an application
- [ ] `GET https://api.example.com/api/docs` returns **404** (Swagger off)
- [ ] A cross-origin request from a random origin is rejected (CORS)
- [ ] 11 rapid `POST /auth/login` from one IP → the 11th is `429`
- [ ] Response headers include `x-content-type-options: nosniff` and no
      `x-powered-by`
- [ ] `docker compose ... exec postgres pg_isready` works from inside, but
      `nc -z <public-ip> 5432` from outside the host **fails** (DB not exposed)
- [ ] Postgres volume (`postgres_data`) and uploads volume (`backend_uploads`)
      are on persistent storage and included in your backup routine

---

## Limitations

These are known and intentional for this release — not bugs, but they cap how
you can run it.

### Résumé files are stored on a local volume (single instance)

Uploaded résumés are written to `/app/uploads` inside the backend container,
persisted via the `backend_uploads` Docker volume. Consequences:

- **One backend instance only.** A second replica cannot see the first's files.
  Do not scale `backend` horizontally.
- **Not portable.** Moving to a new host means copying the volume.
- **Back it up yourself.** `backend_uploads` must be in your backup routine
  alongside `postgres_data`; losing it loses every uploaded résumé.

Object storage (S3 / R2) is the fix and is planned, but **not implemented yet**.
Until then, treat this as a single-instance app.

### Rate-limit store is in-memory (single instance)

The throttler counts requests in the backend process's memory. With more than
one backend instance the effective limit multiplies by the instance count, and a
restart resets all counters. A shared store (Redis via
`@nestjs/throttler`'s storage option) is needed for multi-instance; not wired up
here.

### JWTs are not revocable

Logout is client-side (drop the token). A stolen token is valid until it
expires (`JWT_EXPIRES_IN`, default 1 day). Keep the expiry short-ish; there is no
server-side denylist.

### Dependency advisory

`npm audit` in `backend/` reports a high-severity advisory in a transitive
dependency of `prisma` (`deepmerge-ts`, via `@prisma/config`). The only current
fix is a major Prisma downgrade (7 → 6), which is a breaking change and is not
applied. Track Prisma releases for a patched 7.x.
