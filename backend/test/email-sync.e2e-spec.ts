import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db';
import { registerAndLogin, RegisteredUser } from './utils/auth';
import { PrismaService } from '../src/database/prisma.service';

// gmail/exchange and gmail/sync both require real calls to Google's OAuth and
// Gmail APIs, which this environment cannot make — those flows are covered
// by mocked unit tests in src/email-sync/email-sync.service.spec.ts instead.
// This suite covers everything reachable without a live Google account:
// status/disconnect, config validation, and the review-queue endpoints
// (suggestions are seeded directly via Prisma to stand in for a completed sync).
describe('Email sync (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user: RegisteredUser;
  let authHeader: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    user = await registerAndLogin(app);
    authHeader = `Bearer ${user.accessToken}`;
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
  });

  afterAll(async () => {
    await closeTestApp({ app, prisma });
  });

  describe('GET /email-sync/gmail/status', () => {
    it('reports disconnected for a user who has never connected Gmail', async () => {
      const response = await request(app.getHttpServer())
        .get('/email-sync/gmail/status')
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body).toEqual({
        connected: false,
        email: null,
        lastSyncedAt: null,
        nextSyncAvailableAt: null,
      });
    });

    it('rejects requests without a bearer token', async () => {
      await request(app.getHttpServer()).get('/email-sync/gmail/status').expect(401);
    });
  });

  describe('POST /email-sync/gmail/disconnect', () => {
    it('is a no-op when nothing is connected', async () => {
      const response = await request(app.getHttpServer())
        .post('/email-sync/gmail/disconnect')
        .set('Authorization', authHeader)
        .expect(201);

      expect(response.body).toEqual({ disconnected: true });
    });
  });

  describe('GET /email-sync/gmail/auth-url', () => {
    it('returns 500 with a clear message when Gmail sync is not configured', async () => {
      const response = await request(app.getHttpServer())
        .get('/email-sync/gmail/auth-url')
        .set('Authorization', authHeader)
        .expect(500);

      expect(response.body.message).toMatch(/not configured/i);
    });

    it('builds a Google consent URL with the read-only scope once configured', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:5173/email-sync';

      const response = await request(app.getHttpServer())
        .get('/email-sync/gmail/auth-url')
        .set('Authorization', authHeader)
        .expect(200);

      const url = new URL(response.body.url);
      expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('scope')).toContain('gmail.readonly');
      expect(url.searchParams.get('access_type')).toBe('offline');
    });
  });

  describe('POST /email-sync/gmail/exchange', () => {
    it('rejects a request with no code', async () => {
      await request(app.getHttpServer())
        .post('/email-sync/gmail/exchange')
        .set('Authorization', authHeader)
        .send({})
        .expect(400);
    });
  });

  describe('review queue (suggestions)', () => {
    async function seedSuggestion(overrides: Record<string, unknown> = {}) {
      return prisma.processedEmail.create({
        data: {
          userId: user.userId,
          gmailMessageId: `msg-${Math.random().toString(36).slice(2)}`,
          subject: 'Your application to Acme Robotics has been received',
          fromAddress: 'careers@acmerobotics.com',
          detectedType: 'APPLICATION_RECEIVED',
          confidence: 0.8,
          extractedCompany: 'Acme Robotics',
          extractedPosition: 'Senior Backend Engineer',
          extractedSource: 'acmerobotics.com',
          suggestedAction: 'CREATE_APPLICATION',
          status: 'PENDING',
          ...overrides,
        },
      });
    }

    describe('GET /email-sync/suggestions', () => {
      it('lists only the caller\'s pending suggestions', async () => {
        await seedSuggestion();
        const other = await registerAndLogin(app);
        await prisma.processedEmail.create({
          data: {
            userId: other.userId,
            gmailMessageId: 'other-users-message',
            detectedType: 'APPLICATION_RECEIVED',
            confidence: 0.8,
            extractedCompany: 'Other Co',
            suggestedAction: 'CREATE_APPLICATION',
            status: 'PENDING',
          },
        });

        const response = await request(app.getHttpServer())
          .get('/email-sync/suggestions')
          .set('Authorization', authHeader)
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].extractedCompany).toBe('Acme Robotics');
      });

      it('does not include confirmed or dismissed suggestions', async () => {
        await seedSuggestion({ status: 'DISMISSED' });

        const response = await request(app.getHttpServer())
          .get('/email-sync/suggestions')
          .set('Authorization', authHeader)
          .expect(200);

        expect(response.body).toHaveLength(0);
      });
    });

    describe('POST /email-sync/suggestions/:id/confirm', () => {
      it('creates a new application for a CREATE_APPLICATION suggestion', async () => {
        const suggestion = await seedSuggestion();

        await request(app.getHttpServer())
          .post(`/email-sync/suggestions/${suggestion.id}/confirm`)
          .set('Authorization', authHeader)
          .send({})
          .expect(201);

        const applications = await request(app.getHttpServer())
          .get('/applications')
          .set('Authorization', authHeader)
          .expect(200);

        expect(applications.body.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ company: 'Acme Robotics', position: 'Senior Backend Engineer', status: 'APPLIED' }),
          ]),
        );

        const pending = await request(app.getHttpServer())
          .get('/email-sync/suggestions')
          .set('Authorization', authHeader)
          .expect(200);
        expect(pending.body).toHaveLength(0);
      });

      it('allows overriding the company/position before creating', async () => {
        const suggestion = await seedSuggestion();

        await request(app.getHttpServer())
          .post(`/email-sync/suggestions/${suggestion.id}/confirm`)
          .set('Authorization', authHeader)
          .send({ company: 'Acme Robotics Philippines' })
          .expect(201);

        const applications = await request(app.getHttpServer())
          .get('/applications')
          .set('Authorization', authHeader)
          .expect(200);

        expect(applications.body.data[0].company).toBe('Acme Robotics Philippines');
      });

      it('updates the matched application for an UPDATE_STATUS suggestion', async () => {
        const created = await request(app.getHttpServer())
          .post('/applications')
          .set('Authorization', authHeader)
          .send({ company: 'Acme Robotics', position: 'Senior Backend Engineer', status: 'APPLIED' })
          .expect(201);

        const suggestion = await seedSuggestion({
          detectedType: 'INTERVIEW',
          suggestedAction: 'UPDATE_STATUS',
          matchedApplicationId: created.body.id,
        });

        await request(app.getHttpServer())
          .post(`/email-sync/suggestions/${suggestion.id}/confirm`)
          .set('Authorization', authHeader)
          .send({})
          .expect(201);

        const updated = await request(app.getHttpServer())
          .get(`/applications/${created.body.id}`)
          .set('Authorization', authHeader)
          .expect(200);
        expect(updated.body.status).toBe('INTERVIEW');
      });

      it('rejects confirming a suggestion with no action (NONE)', async () => {
        const suggestion = await seedSuggestion({ suggestedAction: 'NONE' });

        await request(app.getHttpServer())
          .post(`/email-sync/suggestions/${suggestion.id}/confirm`)
          .set('Authorization', authHeader)
          .send({})
          .expect(400);
      });

      it('rejects confirming the same suggestion twice', async () => {
        const suggestion = await seedSuggestion();

        await request(app.getHttpServer())
          .post(`/email-sync/suggestions/${suggestion.id}/confirm`)
          .set('Authorization', authHeader)
          .send({})
          .expect(201);

        await request(app.getHttpServer())
          .post(`/email-sync/suggestions/${suggestion.id}/confirm`)
          .set('Authorization', authHeader)
          .send({})
          .expect(400);
      });

      it('returns 404 for a suggestion belonging to another user', async () => {
        const other = await registerAndLogin(app);
        const suggestion = await prisma.processedEmail.create({
          data: {
            userId: other.userId,
            gmailMessageId: 'cross-user-message',
            detectedType: 'APPLICATION_RECEIVED',
            confidence: 0.8,
            extractedCompany: 'Other Co',
            extractedPosition: 'Engineer',
            suggestedAction: 'CREATE_APPLICATION',
            status: 'PENDING',
          },
        });

        await request(app.getHttpServer())
          .post(`/email-sync/suggestions/${suggestion.id}/confirm`)
          .set('Authorization', authHeader)
          .send({})
          .expect(404);
      });
    });

    describe('POST /email-sync/suggestions/:id/dismiss', () => {
      it('removes the suggestion from the pending queue without touching applications', async () => {
        const suggestion = await seedSuggestion();

        await request(app.getHttpServer())
          .post(`/email-sync/suggestions/${suggestion.id}/dismiss`)
          .set('Authorization', authHeader)
          .expect(201);

        const pending = await request(app.getHttpServer())
          .get('/email-sync/suggestions')
          .set('Authorization', authHeader)
          .expect(200);
        expect(pending.body).toHaveLength(0);

        const applications = await request(app.getHttpServer())
          .get('/applications')
          .set('Authorization', authHeader)
          .expect(200);
        expect(applications.body.data).toHaveLength(0);
      });
    });
  });
});
