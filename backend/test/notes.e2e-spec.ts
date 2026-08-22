import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db';
import { registerAndLogin, RegisteredUser } from './utils/auth';
import { PrismaService } from '../src/database/prisma.service';

describe('Notes (e2e)', () => {
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

  async function addNote(content = 'Recruiter called back.') {
    const response = await request(app.getHttpServer())
      .post(`/applications/${applicationId}/notes`)
      .set('Authorization', authHeader)
      .send({ content })
      .expect(201);

    return response.body;
  }

  it('creates, lists, updates, and deletes a note', async () => {
    const created = await addNote();
    expect(created).toEqual(
      expect.objectContaining({ content: 'Recruiter called back.', applicationId }),
    );

    const list = await request(app.getHttpServer())
      .get(`/applications/${applicationId}/notes`)
      .set('Authorization', authHeader)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const updated = await request(app.getHttpServer())
      .patch(`/applications/${applicationId}/notes/${created.id}`)
      .set('Authorization', authHeader)
      .send({ content: 'Updated note' })
      .expect(200);
    expect(updated.body.content).toBe('Updated note');

    await request(app.getHttpServer())
      .delete(`/applications/${applicationId}/notes/${created.id}`)
      .set('Authorization', authHeader)
      .expect(200);

    const listAfterDelete = await request(app.getHttpServer())
      .get(`/applications/${applicationId}/notes`)
      .set('Authorization', authHeader)
      .expect(200);
    expect(listAfterDelete.body).toHaveLength(0);
  });

  it('rejects empty note content', async () => {
    await request(app.getHttpServer())
      .post(`/applications/${applicationId}/notes`)
      .set('Authorization', authHeader)
      .send({ content: '' })
      .expect(400);
  });

  it("returns 404 for create/list/update/delete on another user's application", async () => {
    const otherUser = await registerAndLogin(app);
    const otherHeader = `Bearer ${otherUser.accessToken}`;

    await request(app.getHttpServer())
      .post(`/applications/${applicationId}/notes`)
      .set('Authorization', otherHeader)
      .send({ content: 'Snooping' })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/applications/${applicationId}/notes`)
      .set('Authorization', otherHeader)
      .expect(404);

    const created = await addNote();

    await request(app.getHttpServer())
      .patch(`/applications/${applicationId}/notes/${created.id}`)
      .set('Authorization', otherHeader)
      .send({ content: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/applications/${applicationId}/notes/${created.id}`)
      .set('Authorization', otherHeader)
      .expect(404);
  });

  it('returns 404 for a note id that does not belong to the application', async () => {
    await request(app.getHttpServer())
      .patch(`/applications/${applicationId}/notes/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', authHeader)
      .send({ content: 'Ghost' })
      .expect(404);
  });
});
