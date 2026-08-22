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
