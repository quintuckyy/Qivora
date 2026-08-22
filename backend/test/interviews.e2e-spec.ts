import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db';
import { registerAndLogin, RegisteredUser } from './utils/auth';
import { PrismaService } from '../src/database/prisma.service';

describe('Interviews (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let user: RegisteredUser;
  let authHeader: string;
  let applicationId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    user = await registerAndLogin(app);
    authHeader = `Bearer ${user.accessToken}`;

    const application = await request(app.getHttpServer())
      .post('/applications')
      .set('Authorization', authHeader)
      .send({ company: 'Infor', position: 'Engineer' })
      .expect(201);
    applicationId = application.body.id;
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await closeTestApp({ app, prisma });
  });

  async function scheduleInterview(overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post(`/applications/${applicationId}/interviews`)
      .set('Authorization', authHeader)
      .send({
        title: 'Technical Interview',
        scheduledAt: '2026-09-01T10:00:00+08:00',
        location: 'Taguig',
        ...overrides,
      })
      .expect(201);

    return response.body;
  }

  it('creates, lists, updates, and deletes an interview', async () => {
    const created = await scheduleInterview();
    expect(created).toEqual(
      expect.objectContaining({ title: 'Technical Interview', applicationId }),
    );

    const list = await request(app.getHttpServer())
      .get(`/applications/${applicationId}/interviews`)
      .set('Authorization', authHeader)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const updated = await request(app.getHttpServer())
      .patch(`/applications/${applicationId}/interviews/${created.id}`)
      .set('Authorization', authHeader)
      .send({ title: 'Final Interview' })
      .expect(200);
    expect(updated.body.title).toBe('Final Interview');

    await request(app.getHttpServer())
      .delete(`/applications/${applicationId}/interviews/${created.id}`)
      .set('Authorization', authHeader)
      .expect(200);

    const listAfterDelete = await request(app.getHttpServer())
      .get(`/applications/${applicationId}/interviews`)
      .set('Authorization', authHeader)
      .expect(200);
    expect(listAfterDelete.body).toHaveLength(0);
  });

  it('rejects an invalid scheduledAt value', async () => {
    await request(app.getHttpServer())
      .post(`/applications/${applicationId}/interviews`)
      .set('Authorization', authHeader)
      .send({ title: 'Technical Interview', scheduledAt: 'not-a-date' })
      .expect(400);
  });

  it("returns 404 for create/list/update/delete on another user's application", async () => {
    const otherUser = await registerAndLogin(app);
    const otherHeader = `Bearer ${otherUser.accessToken}`;

    await request(app.getHttpServer())
      .post(`/applications/${applicationId}/interviews`)
      .set('Authorization', otherHeader)
      .send({ title: 'Technical Interview', scheduledAt: '2026-09-01T10:00:00+08:00' })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/applications/${applicationId}/interviews`)
      .set('Authorization', otherHeader)
      .expect(404);

    const created = await scheduleInterview();

    await request(app.getHttpServer())
      .patch(`/applications/${applicationId}/interviews/${created.id}`)
      .set('Authorization', otherHeader)
      .send({ title: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/applications/${applicationId}/interviews/${created.id}`)
      .set('Authorization', otherHeader)
      .expect(404);
  });

  it('returns 404 for an interview id that does not belong to the application', async () => {
    await request(app.getHttpServer())
      .patch(`/applications/${applicationId}/interviews/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', authHeader)
      .send({ title: 'Ghost' })
      .expect(404);
  });
});
