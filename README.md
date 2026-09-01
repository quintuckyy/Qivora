# Qivora

A job application tracker — pipeline, interviews, notes, résumés, application
history, analytics, optional Gmail sync for status updates, and a companion
browser extension that saves postings from LinkedIn / Indeed / JobStreet.

- **`backend/`** — NestJS + Prisma (PostgreSQL) API. See [backend/README.md](backend/README.md).
- **`frontend/`** — React + Vite SPA.
- **`extension/`** — MV3 browser extension. See [extension/README.md](extension/README.md).

## Quick start (Docker)

```bash
cp .env.example .env          # set JWT_SECRET at minimum
docker compose up -d --build  # http://localhost:5173
```

`docker-compose.override.yml` is loaded automatically for local development
(it exposes Postgres on `127.0.0.1:5432`).

## Local development (no Docker)

```bash
# Postgres running locally, then:
cd backend  && cp .env.example .env && npm install && npx prisma migrate deploy && npm run start:dev
cd frontend && npm install && npm run dev
```

## Tests

```bash
cd backend  && npm test           # unit
cd backend  && npm run test:e2e   # needs a *_test database (see backend/.env.test)
cd frontend && npm run build
cd extension && npm test
```

## Deploying

See **[DEPLOYMENT.md](DEPLOYMENT.md)** — production compose file, required
secrets, TLS, CORS for the web app and extension origins, and current
single-instance limitations.
