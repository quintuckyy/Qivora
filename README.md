# Qivora

**Your smarter path to the next opportunity.**

Qivora is a full-stack job search management platform designed to help users capture, organize, and monitor job applications from discovery through interview, offer, or rejection.

Instead of functioning as a simple manual job tracker, Qivora combines a web dashboard, browser extension, Gmail synchronization, resume management, application workflows, and automated email detection into one system.

---

## Features

### Job Application Management

* Create, update, search, filter, sort, and paginate job applications
* Track salary range, location, job URL, resume used, and other application details
* Ownership-scoped data so users can only access their own applications
* Duplicate protection using job URLs
* Application history for every status transition

Application workflow:

```text
APPLIED → ASSESSMENT → INTERVIEW → OFFER
    │           │            │
    └───────────┴────────────┴──→ REJECTED
```

`REJECTED` is treated as a terminal status, while valid forward transitions are recorded transactionally in application history.

---

## Gmail Email Sync

Qivora can connect to a user's Gmail account through Google OAuth and detect job-related email updates automatically.

Supported detections include:

* Application confirmations
* Assessments
* Interview invitations
* Rejections
* Offers

Detected emails are parsed and matched against existing applications. Rather than silently modifying application data, Qivora places proposed changes into a **Review Queue** for the user to confirm or dismiss.

Email synchronization supports:

* Manual Gmail sync
* Automatic background sync every 12 minutes
* Duplicate email processing prevention
* Encrypted OAuth tokens
* Per-user synchronization locking
* Gmail reconnect handling for expired/revoked authorization
* Pending-review notification badge
* Provider-specific parsing for LinkedIn, Indeed, JobStreet, and generic recruiter/company emails

---

## Browser Extension

Qivora includes a Manifest V3 browser extension that allows users to save jobs directly from supported job platforms.

Currently supported:

* LinkedIn
* Indeed
* JobStreet

The extension can extract:

* Job title
* Company
* Location
* Job URL
* Salary information when available

Users can review and edit detected information before sending the application to Qivora.

The extension maintains its own authenticated session using `chrome.storage.local` and connects to the same backend API as the web application.

---

## Dashboard

The dashboard provides a quick operational overview of the user's job search.

It includes:

* Active pipeline
* Total applications
* Interviews
* Offers
* Rejections
* Week / month / year application activity
* Recent applications
* Upcoming interviews
* Needs Attention indicators
* Email Sync notifications

The goal of the dashboard is to surface both progress and actions that may require attention rather than simply displaying raw statistics.

---

## Resume Management

Users can maintain multiple resume versions and associate them with individual applications.

Features include:

* PDF, DOC, and DOCX uploads
* Resume version management
* Download and deletion
* Resume assignment to applications
* Usage tracking
* Resume-related application performance
* PDF preview where supported

Resume files are currently stored using local persistent storage and are intended for single-instance deployment unless migrated to object storage.

---

## Interviews & Notes

Each application can contain:

### Interviews

* Interview title
* Scheduled date and time
* Location
* Meeting URL
* Notes

### Notes

Users can maintain application-specific notes throughout the hiring process.

Both modules enforce application ownership through the authenticated user.

---

## Authentication

Qivora supports:

* Email/password registration
* Email/password login
* Google Sign-In
* Forgot password
* Password reset
* JWT authentication
* Role-based authorization foundation

Passwords are hashed with **Argon2**.

Password reset tokens are cryptographically generated, stored only as SHA-256 hashes, expire after 20 minutes, and are single-use. Password-reset emails are sent through Brevo.

Google authentication and Gmail synchronization are intentionally separate permission flows. Signing in with Google only requests identity information, while Gmail access is requested separately when the user enables Email Sync.

---

## Technology Stack

### Backend

| Technology          | Purpose                          |
| ------------------- | -------------------------------- |
| NestJS 11           | Backend framework                |
| TypeScript          | Application language             |
| Prisma 7            | ORM                              |
| PostgreSQL 17       | Relational database              |
| Argon2              | Password hashing                 |
| JWT                 | Authentication                   |
| `@nestjs/schedule`  | Background Gmail synchronization |
| `@nestjs/throttler` | API rate limiting                |
| Helmet              | Security headers                 |
| Swagger / OpenAPI   | API documentation                |
| Jest                | Unit testing                     |
| Supertest           | End-to-end API testing           |
| Docker              | Containerization                 |

The backend uses Prisma's PostgreSQL driver adapter and a generated Prisma client.

### Frontend

| Technology               | Purpose                   |
| ------------------------ | ------------------------- |
| React 19                 | UI framework              |
| TypeScript               | Type-safe frontend        |
| Vite                     | Development/build tooling |
| React Router             | Routing                   |
| Custom CSS design system | Styling                   |
| Fetch API                | Backend communication     |

The UI uses a dark navy/cyan Qivora design system with custom dashboard cards, dropdowns, status badges, charts, responsive layouts, loading states, and error states.

### Browser Extension

| Technology     | Purpose                         |
| -------------- | ------------------------------- |
| TypeScript     | Extension logic                 |
| Vite           | Build tooling                   |
| Manifest V3    | Chrome extension platform       |
| Chrome APIs    | Storage and browser integration |
| Vitest + jsdom | Extractor testing               |

---

## Architecture

```text
┌────────────────────────────┐
│ Browser Extension          │
│ LinkedIn / Indeed /        │
│ JobStreet capture          │
└──────────────┬─────────────┘
               │
               │ REST + JWT
               ▼
┌────────────────────────────┐
│ React Web Application      │
│ Dashboard / Applications   │
│ Resumes / Email Sync       │
└──────────────┬─────────────┘
               │
               │ REST + JWT
               ▼
┌────────────────────────────┐
│ NestJS Backend             │
│                            │
│ Auth                       │
│ Applications               │
│ Interviews                 │
│ Notes                      │
│ Resumes                    │
│ Email Sync                 │
│ Background Scheduler       │
└───────┬──────────┬─────────┘
        │          │
        │          ├──────────────► Brevo
        │          │                Password-reset email
        │
        ├─────────────────────────► Google OAuth / Gmail API
        │
        ▼
┌────────────────────────────┐
│ PostgreSQL                 │
│ Prisma ORM                 │
└────────────────────────────┘
```

The browser extension and frontend use independent client sessions but communicate with the same NestJS API. Gmail OAuth tokens are encrypted before being stored in PostgreSQL.

---

## Repository Structure

```text
job-application-tracker/
├── backend/
│   ├── src/
│   ├── prisma/
│   ├── test/
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
│
├── extension/
│   ├── src/
│   ├── test/
│   └── manifest.json
│
├── docker-compose.yml
├── docker-compose.override.yml
├── docker-compose.prod.yml
├── DEPLOYMENT.md
└── README.md
```

The backend is organized into NestJS feature modules, while the extension keeps platform-specific extraction logic isolated for easier maintenance.

---

## API Documentation

Swagger documentation is available during development at:

```text
http://localhost:3000/api/docs
```

Swagger is disabled by default in production.

Major API groups include:

```text
/auth
/applications
/applications/:applicationId/interviews
/applications/:applicationId/notes
/resumes
/email-sync
/health
```

The API inventory includes application CRUD, duplicate detection, workflow status changes, history, resume assignment, Gmail synchronization, suggestion review, password reset, and Google authentication.

---

## Local Development

### Requirements

* Node.js
* npm
* Docker + Docker Compose
* PostgreSQL through Docker
* Google OAuth credentials for Gmail/Google features
* Brevo API credentials for real password-reset emails

### Start infrastructure

From the repository root:

```bash
docker compose up -d postgres
```

### Backend

```bash
cd backend

npm install
npx prisma generate
npx prisma migrate dev
npm run start:dev
```

Backend:

```text
http://localhost:3000
```

Swagger:

```text
http://localhost:3000/api/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

### Browser Extension

```bash
cd extension
npm install
npm run build
```

Load the generated extension as an unpacked extension in Chrome/Edge.

---

## Docker

To build and run the complete application:

```bash
docker compose up -d --build
```

For production-style Compose:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build
```

PostgreSQL is intentionally not exposed publicly in the production Compose configuration.

Development-only PostgreSQL port exposure is handled through:

```text
docker-compose.override.yml
```

---

## Environment Configuration

Create local `.env` files from the provided examples.

Important backend variables include:

```env
DATABASE_URL=
JWT_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=
EMAIL_SYNC_ENCRYPTION_KEY=

BREVO_API_KEY=
MAIL_FROM=

FRONTEND_ORIGIN=
ENABLE_SWAGGER=
THROTTLE_ENABLED=
```

Frontend:

```env
VITE_API_BASE_URL=
VITE_GOOGLE_CLIENT_ID=
```

Never commit production secrets.

For production, generate strong secrets rather than reusing development values.

Example:

```bash
openssl rand -base64 48
openssl rand -base64 32
```

---

## Security

Current security measures include:

* Argon2 password hashing
* JWT authentication
* Ownership-scoped application data
* DTO validation and unknown-property rejection
* CORS allowlisting
* Helmet security headers
* Authentication rate limiting
* Generic forgot-password responses to prevent account enumeration
* Hashed single-use password-reset tokens
* Encrypted Gmail OAuth tokens
* Database-level job URL duplicate constraints
* PostgreSQL not exposed publicly in production
* Swagger disabled by default in production
* Non-root Docker backend runtime

Production deployments must use HTTPS/TLS.

---

## Testing

Current automated test coverage includes:

```text
Backend unit tests:   305 passing
Backend E2E tests:    114 passing
Extension tests:       27 passing
```

Backend unit tests cover authentication, authorization, application workflows, statistics, Gmail synchronization, email parsing/classification, scheduling, security configuration, throttling, and other service/controller behavior.

E2E tests run against a real PostgreSQL test database.

Run tests with:

```bash
cd backend
npm test
npm run test:e2e
npm run build
```

Extension:

```bash
cd extension
npm test
npm run typecheck
npm run build
```

Frontend:

```bash
cd frontend
npm run build
```

---

## Production Deployment

Qivora's Docker setup is suitable for a single-instance deployment, but production hosting must provide TLS termination.

Before exposing Qivora publicly:

```text
✓ Configure HTTPS/TLS
✓ Generate production JWT/database secrets
✓ Configure production Google OAuth origins
✓ Configure Gmail OAuth redirect URI
✓ Verify Brevo sender
✓ Configure FRONTEND_ORIGIN
✓ Configure VITE_API_BASE_URL
✓ Ensure PostgreSQL is not publicly exposed
✓ Enable persistent database/resume backups
✓ Perform production smoke testing
```

See:

```text
DEPLOYMENT.md
```

for the full deployment runbook.

---

## Current Deployment Constraints

Qivora currently assumes a single backend instance.

The following components would require changes before horizontal scaling:

* Gmail scheduler locking is in-memory
* Rate-limiting storage is in-memory
* Resume uploads use local persistent storage

A multi-instance architecture would likely require:

```text
Redis / distributed locking
Shared rate-limit storage
S3 / R2 / GCS object storage
Managed PostgreSQL
Centralized logging / monitoring
```

These are intentionally deferred from the current release.

---

## Why I Built Qivora

Qivora started from a practical problem: managing job applications across different platforms quickly becomes fragmented.

Applications may originate from LinkedIn, JobStreet, Indeed, recruiter outreach, or company career pages. Updates arrive through email. Different resumes are used for different roles. Interviews and follow-ups need to be tracked separately.

Qivora brings those workflows together:

```text
Discover a job
      ↓
Capture it through the extension
      ↓
Track the application
      ↓
Detect updates through Gmail
      ↓
Review status suggestions
      ↓
Manage interviews, notes, and resumes
      ↓
Understand job-search progress
```

The project is also designed as a production-style full-stack engineering portfolio demonstrating API design, authentication, relational modeling, background processing, browser-extension development, third-party OAuth integration, automated testing, Dockerization, and application security.

---

## Status

**Qivora v1 — Feature Complete**

The application is currently suitable for local/private demonstration and production-style single-instance deployment after environment, OAuth, email-provider, persistence, and TLS configuration.

---

## License

This project is currently maintained as a personal portfolio project.

---

**Qivora**
*Your smarter path to the next opportunity.*
