import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db';
import { registerAndLogin, RegisteredUser } from './utils/auth';
import { PrismaService } from '../src/database/prisma.service';

describe('Resumes (e2e)', () => {
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

  async function uploadResume(filename = 'resume.pdf', contentType = 'application/pdf') {
    const response = await request(app.getHttpServer())
      .post('/resumes')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from('%PDF-1.4 test resume content'), {
        filename,
        contentType,
      })
      .expect(201);

    return response.body;
  }

  it('uploads a resume via multipart form data and returns its metadata', async () => {
    const resume = await uploadResume();

    expect(resume).toEqual(
      expect.objectContaining({
        name: 'resume.pdf',
        originalName: 'resume.pdf',
        mimeType: 'application/pdf',
        userId: user.userId,
      }),
    );
    expect(typeof resume.id).toBe('string');
  });

  it('marks the first uploaded resume as the default and later ones as non-default', async () => {
    const first = await uploadResume('first.pdf');
    const second = await uploadResume('second.pdf');

    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);
  });

  it('returns usage counts and performance metrics for each resume', async () => {
    const resume = await uploadResume();

    const application = await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', authHeader)
      .send({ company: 'Infor', position: 'Engineer' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/applications/${application.body.id}/resume`)
      .set('Authorization', authHeader)
      .send({ resumeId: resume.id })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/applications/${application.body.id}/status`)
      .set('Authorization', authHeader)
      .send({ status: 'INTERVIEW' })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/resumes')
      .set('Authorization', authHeader)
      .expect(200);

    expect(list.body[0]).toEqual(
      expect.objectContaining({
        applicationCount: 1,
        metrics: { applications: 1, interviews: 1, offers: 0 },
      }),
    );
  });

  it('renames a resume version', async () => {
    const resume = await uploadResume();

    const response = await request(app.getHttpServer())
      .patch(`/resumes/${resume.id}`)
      .set('Authorization', authHeader)
      .send({ name: 'Backend .NET' })
      .expect(200);

    expect(response.body.name).toBe('Backend .NET');
  });

  it('moves the default flag when a different resume is set as default', async () => {
    const first = await uploadResume('first.pdf');
    const second = await uploadResume('second.pdf');

    await request(app.getHttpServer())
      .patch(`/resumes/${second.id}/default`)
      .set('Authorization', authHeader)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/resumes')
      .set('Authorization', authHeader)
      .expect(200);

    const byId = Object.fromEntries(
      list.body.map((r: { id: string; isDefault: boolean }) => [r.id, r.isDefault]),
    );
    expect(byId[second.id]).toBe(true);
    expect(byId[first.id]).toBe(false);
  });

  it('streams a resume inline for preview', async () => {
    const resume = await uploadResume();

    const response = await request(app.getHttpServer())
      .get(`/resumes/${resume.id}/preview`)
      .set('Authorization', authHeader)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(response.headers['content-disposition']).toContain('inline');
    expect(response.headers['content-type']).toContain('application/pdf');
  });

  it("returns 404 renaming another user's resume", async () => {
    const resume = await uploadResume();
    const otherUser = await registerAndLogin(app);

    await request(app.getHttpServer())
      .patch(`/resumes/${resume.id}`)
      .set('Authorization', `Bearer ${otherUser.accessToken}`)
      .send({ name: 'Nope' })
      .expect(404);
  });

  it('rejects an upload with a disallowed mime type', async () => {
    await request(app.getHttpServer())
      .post('/resumes')
      .set('Authorization', authHeader)
      .attach('file', Buffer.from('plain text content'), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      })
      .expect(400);
  });

  it('rejects an upload without a bearer token', async () => {
    await request(app.getHttpServer())
      .post('/resumes')
      .attach('file', Buffer.from('%PDF-1.4 test resume content'), {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      })
      .expect(401);
  });

  it('lists only resumes owned by the caller', async () => {
    await uploadResume();
    const otherUser = await registerAndLogin(app);
    await request(app.getHttpServer())
      .post('/resumes')
      .set('Authorization', `Bearer ${otherUser.accessToken}`)
      .attach('file', Buffer.from('%PDF-1.4 other user resume'), {
        filename: 'other.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/resumes')
      .set('Authorization', authHeader)
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].originalName).toBe('resume.pdf');
  });

  it('downloads an owned resume', async () => {
    const resume = await uploadResume();

    const response = await request(app.getHttpServer())
      .get(`/resumes/${resume.id}/download`)
      .set('Authorization', authHeader)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(response.headers['content-disposition']).toContain('resume.pdf');
    expect((response.body as Buffer).toString()).toContain(
      'test resume content',
    );
  });

  it("returns 404 downloading another user's resume", async () => {
    const resume = await uploadResume();
    const otherUser = await registerAndLogin(app);

    await request(app.getHttpServer())
      .get(`/resumes/${resume.id}/download`)
      .set('Authorization', `Bearer ${otherUser.accessToken}`)
      .expect(404);
  });

  it('deletes an owned resume', async () => {
    const resume = await uploadResume();

    await request(app.getHttpServer())
      .delete(`/resumes/${resume.id}`)
      .set('Authorization', authHeader)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/resumes')
      .set('Authorization', authHeader)
      .expect(200);
    expect(list.body).toHaveLength(0);
  });

  it("returns 404 deleting another user's resume", async () => {
    const resume = await uploadResume();
    const otherUser = await registerAndLogin(app);

    await request(app.getHttpServer())
      .delete(`/resumes/${resume.id}`)
      .set('Authorization', `Bearer ${otherUser.accessToken}`)
      .expect(404);
  });
});
