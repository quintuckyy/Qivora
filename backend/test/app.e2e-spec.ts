import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db';
import { registerAndLogin } from './utils/auth';
import { PrismaService } from '../src/database/prisma.service';
import { Role } from '../src/generated/prisma/enums';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await closeTestApp({ app, prisma });
  });

  describe('/health (GET)', () => {
    it('reports ok status and a live database connection', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({ status: 'ok', database: 'connected' }),
      );
    });
  });

  describe('/protected (GET)', () => {
    it('rejects requests without a bearer token', async () => {
      await request(app.getHttpServer()).get('/protected').expect(401);
    });

    it('rejects requests with an invalid token', async () => {
      await request(app.getHttpServer())
        .get('/protected')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('allows access with a valid token and attaches the decoded user', async () => {
      const { accessToken, userId, email } = await registerAndLogin(app);

      const response = await request(app.getHttpServer())
        .get('/protected')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toBe('You are authenticated');
      expect(response.body.user).toEqual(
        expect.objectContaining({ sub: userId, email }),
      );
    });
  });

  describe('/admin (GET)', () => {
    it('denies access to a regular USER role', async () => {
      const { accessToken } = await registerAndLogin(app);

      await request(app.getHttpServer())
        .get('/admin')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('allows access to an ADMIN role', async () => {
      const password = 'password123';
      const { userId, email } = await registerAndLogin(app, { password });
      await prisma.user.update({
        where: { id: userId },
        data: { role: Role.ADMIN },
      });

      // Re-login: the JWT payload captures the role at sign time, so the
      // pre-promotion token would still carry USER.
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);

      await request(app.getHttpServer())
        .get('/admin')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .expect(200);
    });
  });
});
