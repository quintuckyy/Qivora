import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db';
import { registerAndLogin, RegisteredUser } from './utils/auth';
import { PrismaService } from '../src/database/prisma.service';

describe('Applications (e2e)', () => {
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
  });

  afterAll(async () => {
    await closeTestApp({ app, prisma });
  });

  async function createApplication(overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', authHeader)
      .send({
        company: 'Infor',
        position: 'Senior Software Engineer',
        salaryMin: 140000,
        salaryMax: 160000,
        location: 'Taguig, Metro Manila',
        jobUrl: 'https://careers.example.com/jobs/123',
        ...overrides,
      })
      .expect(201);

    return response.body;
  }

  describe('POST /applications', () => {
    it('creates a job application owned by the authenticated user', async () => {
      const application = await createApplication();

      expect(application).toEqual(
        expect.objectContaining({
          company: 'Infor',
          position: 'Senior Software Engineer',
          status: 'APPLIED',
          userId: user.userId,
        }),
      );
    });

    it('rejects requests without a bearer token', async () => {
      await request(app.getHttpServer())
        .post('/applications')
        .send({ company: 'Infor', position: 'Engineer' })
        .expect(401);
    });

    it('rejects an invalid jobUrl', async () => {
      await request(app.getHttpServer())
        .post('/applications')
        .set('Authorization', authHeader)
        .send({ company: 'Infor', position: 'Engineer', jobUrl: 'not-a-url' })
        .expect(400);
    });

    it('rejects an invalid status enum value', async () => {
      await request(app.getHttpServer())
        .post('/applications')
        .set('Authorization', authHeader)
        .send({ company: 'Infor', position: 'Engineer', status: 'BOGUS' })
        .expect(400);
    });

    it('rejects a second save of the same jobUrl for the same user with 409, not a raw 500', async () => {
      const jobUrl = 'https://ph.jobstreet.com/job/94092861';
      await createApplication({ jobUrl });

      const response = await request(app.getHttpServer())
        .post('/applications')
        .set('Authorization', authHeader)
        .send({ company: 'Infor', position: 'Senior Software Engineer', jobUrl })
        .expect(409);

      expect(response.body.message).toMatch(/already saved/i);
    });

    it('allows two different users to independently save the same jobUrl', async () => {
      const jobUrl = 'https://ph.jobstreet.com/job/94092861';
      await createApplication({ jobUrl });

      const otherUser = await registerAndLogin(app);
      await request(app.getHttpServer())
        .post('/applications')
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .send({ company: 'Infor', position: 'Senior Software Engineer', jobUrl })
        .expect(201);
    });

    it('allows saving multiple applications with no jobUrl at all', async () => {
      await createApplication({ jobUrl: undefined, company: 'Infor A' });
      await createApplication({ jobUrl: undefined, company: 'Infor B' });
    });
  });

  describe('GET /applications/check-duplicate', () => {
    it('reports exists: false for a job URL not yet saved', async () => {
      const response = await request(app.getHttpServer())
        .get('/applications/check-duplicate')
        .query({ jobUrl: 'https://www.linkedin.com/jobs/view/999999/' })
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body).toEqual({ exists: false, application: null });
    });

    it('reports exists: true with a summary once that job URL has been saved', async () => {
      const jobUrl = 'https://www.linkedin.com/jobs/view/1234567890/';
      const created = await createApplication({ jobUrl });

      const response = await request(app.getHttpServer())
        .get('/applications/check-duplicate')
        .query({ jobUrl })
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body).toEqual({
        exists: true,
        application: expect.objectContaining({
          id: created.id,
          company: created.company,
          position: created.position,
          status: created.status,
        }),
      });
    });

    it("does not see another user's saved job URL", async () => {
      const jobUrl = 'https://www.linkedin.com/jobs/view/1234567890/';
      await createApplication({ jobUrl });
      const otherUser = await registerAndLogin(app);

      const response = await request(app.getHttpServer())
        .get('/applications/check-duplicate')
        .query({ jobUrl })
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .expect(200);

      expect(response.body).toEqual({ exists: false, application: null });
    });

    it('rejects a request without a jobUrl', async () => {
      await request(app.getHttpServer())
        .get('/applications/check-duplicate')
        .set('Authorization', authHeader)
        .expect(400);
    });

    it('rejects an invalid jobUrl', async () => {
      await request(app.getHttpServer())
        .get('/applications/check-duplicate')
        .query({ jobUrl: 'not-a-url' })
        .set('Authorization', authHeader)
        .expect(400);
    });

    it('rejects requests without a bearer token', async () => {
      await request(app.getHttpServer())
        .get('/applications/check-duplicate')
        .query({ jobUrl: 'https://www.linkedin.com/jobs/view/1/' })
        .expect(401);
    });
  });

  describe('GET /applications/:id', () => {
    it('returns the application when owned by the caller', async () => {
      const created = await createApplication();

      const response = await request(app.getHttpServer())
        .get(`/applications/${created.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body.id).toBe(created.id);
    });

    it('returns 404 for an application owned by another user', async () => {
      const created = await createApplication();
      const otherUser = await registerAndLogin(app);

      await request(app.getHttpServer())
        .get(`/applications/${created.id}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .expect(404);
    });

    it('returns 404 for a non-existent id', async () => {
      await request(app.getHttpServer())
        .get('/applications/00000000-0000-0000-0000-000000000000')
        .set('Authorization', authHeader)
        .expect(404);
    });
  });

  describe('PATCH /applications/:id', () => {
    it('updates fields on an owned application', async () => {
      const created = await createApplication();

      const response = await request(app.getHttpServer())
        .patch(`/applications/${created.id}`)
        .set('Authorization', authHeader)
        .send({ company: 'Updated Co' })
        .expect(200);

      expect(response.body.company).toBe('Updated Co');
    });

    it("returns 404 when updating another user's application", async () => {
      const created = await createApplication();
      const otherUser = await registerAndLogin(app);

      await request(app.getHttpServer())
        .patch(`/applications/${created.id}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .send({ company: 'Hijacked' })
        .expect(404);
    });
  });

  describe('DELETE /applications/:id', () => {
    it('deletes an owned application', async () => {
      const created = await createApplication();

      await request(app.getHttpServer())
        .delete(`/applications/${created.id}`)
        .set('Authorization', authHeader)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/applications/${created.id}`)
        .set('Authorization', authHeader)
        .expect(404);
    });

    it("returns 404 when deleting another user's application", async () => {
      const created = await createApplication();
      const otherUser = await registerAndLogin(app);

      await request(app.getHttpServer())
        .delete(`/applications/${created.id}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .expect(404);
    });
  });

  describe('GET /applications (list)', () => {
    it('only returns applications owned by the caller', async () => {
      await createApplication({ company: 'Mine' });
      const otherUser = await registerAndLogin(app);
      await request(app.getHttpServer())
        .post('/applications')
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .send({ company: 'Theirs', position: 'Engineer' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/applications')
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].company).toBe('Mine');
    });

    it('paginates results and reports meta', async () => {
      for (let i = 0; i < 5; i += 1) {
        await createApplication({ company: `Company ${i}`, jobUrl: `https://careers.example.com/jobs/${i}` });
      }

      const response = await request(app.getHttpServer())
        .get('/applications')
        .query({ page: 2, limit: 2 })
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.meta).toEqual({
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
    });

    it('filters by status', async () => {
      await createApplication({ company: 'Applied Co', jobUrl: 'https://careers.example.com/jobs/applied' });
      const assessment = await createApplication({
        company: 'Assessment Co',
        jobUrl: 'https://careers.example.com/jobs/assessment',
      });
      await request(app.getHttpServer())
        .patch(`/applications/${assessment.id}/status`)
        .set('Authorization', authHeader)
        .send({ status: 'ASSESSMENT' })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/applications')
        .query({ status: 'ASSESSMENT' })
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].company).toBe('Assessment Co');
    });

    it('filters to applications assigned a specific resume', async () => {
      const resume = await request(app.getHttpServer())
        .post('/resumes')
        .set('Authorization', authHeader)
        .attach('file', Buffer.from('%PDF-1.4 resume'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      const withResume = await createApplication({
        company: 'Has Resume Co',
        jobUrl: 'https://careers.example.com/jobs/has-resume',
      });
      await createApplication({
        company: 'No Resume Co',
        jobUrl: 'https://careers.example.com/jobs/no-resume',
      });

      await request(app.getHttpServer())
        .patch(`/applications/${withResume.id}/resume`)
        .set('Authorization', authHeader)
        .send({ resumeId: resume.body.id })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/applications')
        .query({ resumeId: resume.body.id })
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].company).toBe('Has Resume Co');
    });

    it('searches across company, position, and location (case-insensitive)', async () => {
      await createApplication({
        company: 'Infor',
        position: 'Engineer',
        location: 'Manila',
        jobUrl: 'https://careers.example.com/jobs/infor',
      });
      await createApplication({
        company: 'Other Co',
        position: 'Designer',
        location: 'Cebu',
        jobUrl: 'https://careers.example.com/jobs/other',
      });

      const response = await request(app.getHttpServer())
        .get('/applications')
        .query({ search: 'infor' })
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].company).toBe('Infor');
    });

    it('sorts by the requested field and order', async () => {
      await createApplication({ company: 'Charlie Co', jobUrl: 'https://careers.example.com/jobs/charlie' });
      await createApplication({ company: 'Alpha Co', jobUrl: 'https://careers.example.com/jobs/alpha' });
      await createApplication({ company: 'Bravo Co', jobUrl: 'https://careers.example.com/jobs/bravo' });

      const response = await request(app.getHttpServer())
        .get('/applications')
        .query({ sortBy: 'company', sortOrder: 'asc' })
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body.data.map((a: { company: string }) => a.company)).toEqual([
        'Alpha Co',
        'Bravo Co',
        'Charlie Co',
      ]);
    });

    it('transforms numeric query params from strings', async () => {
      await createApplication();

      const response = await request(app.getHttpServer())
        .get('/applications')
        .query({ page: '1', limit: '5' })
        .set('Authorization', authHeader)
        .expect(200);

      expect(response.body.meta).toEqual(
        expect.objectContaining({ page: 1, limit: 5 }),
      );
    });

    it('rejects a limit above the maximum bound', async () => {
      await request(app.getHttpServer())
        .get('/applications')
        .query({ limit: 1000 })
        .set('Authorization', authHeader)
        .expect(400);
    });

    it('rejects a page below the minimum bound', async () => {
      await request(app.getHttpServer())
        .get('/applications')
        .query({ page: 0 })
        .set('Authorization', authHeader)
        .expect(400);
    });

    it('rejects an invalid sortBy value', async () => {
      await request(app.getHttpServer())
        .get('/applications')
        .query({ sortBy: 'notAField' })
        .set('Authorization', authHeader)
        .expect(400);
    });
  });

  describe('PATCH /applications/:id/status', () => {
    it('allows a valid forward transition and persists history', async () => {
      const created = await createApplication();

      const response = await request(app.getHttpServer())
        .patch(`/applications/${created.id}/status`)
        .set('Authorization', authHeader)
        .send({ status: 'INTERVIEW' })
        .expect(200);

      expect(response.body.status).toBe('INTERVIEW');

      const history = await request(app.getHttpServer())
        .get(`/applications/${created.id}/history`)
        .set('Authorization', authHeader)
        .expect(200);

      expect(history.body).toHaveLength(1);
      expect(history.body[0]).toEqual(
        expect.objectContaining({ fromStatus: 'APPLIED', toStatus: 'INTERVIEW' }),
      );
    });

    it('rejects a backward transition', async () => {
      const created = await createApplication();
      await request(app.getHttpServer())
        .patch(`/applications/${created.id}/status`)
        .set('Authorization', authHeader)
        .send({ status: 'INTERVIEW' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/applications/${created.id}/status`)
        .set('Authorization', authHeader)
        .send({ status: 'APPLIED' })
        .expect(400);
    });

    it('rejects any transition once REJECTED', async () => {
      const created = await createApplication();
      await request(app.getHttpServer())
        .patch(`/applications/${created.id}/status`)
        .set('Authorization', authHeader)
        .send({ status: 'REJECTED' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/applications/${created.id}/status`)
        .set('Authorization', authHeader)
        .send({ status: 'OFFER' })
        .expect(400);
    });

    it('rejects an invalid enum value', async () => {
      const created = await createApplication();

      await request(app.getHttpServer())
        .patch(`/applications/${created.id}/status`)
        .set('Authorization', authHeader)
        .send({ status: 'NOT_A_STATUS' })
        .expect(400);
    });
  });

  describe('PATCH /applications/:id/resume', () => {
    async function uploadResume(token: string) {
      const response = await request(app.getHttpServer())
        .post('/resumes')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', Buffer.from('%PDF-1.4 test resume'), {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      return response.body;
    }

    it('assigns a resume owned by the caller', async () => {
      const created = await createApplication();
      const resume = await uploadResume(user.accessToken);

      const response = await request(app.getHttpServer())
        .patch(`/applications/${created.id}/resume`)
        .set('Authorization', authHeader)
        .send({ resumeId: resume.id })
        .expect(200);

      expect(response.body.resumeId).toBe(resume.id);
    });

    it('returns 404 when the resume belongs to another user', async () => {
      const created = await createApplication();
      const otherUser = await registerAndLogin(app);
      const theirResume = await uploadResume(otherUser.accessToken);

      await request(app.getHttpServer())
        .patch(`/applications/${created.id}/resume`)
        .set('Authorization', authHeader)
        .send({ resumeId: theirResume.id })
        .expect(404);
    });

    it('returns 404 when the application belongs to another user', async () => {
      const created = await createApplication();
      const resume = await uploadResume(user.accessToken);
      const otherUser = await registerAndLogin(app);

      await request(app.getHttpServer())
        .patch(`/applications/${created.id}/resume`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .send({ resumeId: resume.id })
        .expect(404);
    });

    it('returns 404 for a non-existent resume id', async () => {
      const created = await createApplication();

      await request(app.getHttpServer())
        .patch(`/applications/${created.id}/resume`)
        .set('Authorization', authHeader)
        .send({ resumeId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });
  });
});
