import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db';
import { PrismaService } from '../src/database/prisma.service';
import { AUTH_LIMIT, PASSWORD_RESET_LIMIT } from '../src/config/throttling';

// Rate limiting is disabled for the rest of the e2e suite (jest-e2e.setup.ts);
// this spec turns it back on for itself. `skipIf` re-reads the env per request,
// so flipping the flag here is enough.
describe('Rate limiting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    process.env.THROTTLE_ENABLED = 'true';
    ({ app, prisma } = await createTestApp());
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    process.env.THROTTLE_ENABLED = 'false';
    await closeTestApp({ app, prisma });
  });

  it(`limits /auth/login to ${AUTH_LIMIT.limit} attempts per window`, async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong-password' });

    for (let i = 0; i < AUTH_LIMIT.limit; i++) {
      const res = await attempt();
      expect(res.status).toBe(401);
    }

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
  });

  it(`limits /auth/forgot-password to ${PASSWORD_RESET_LIMIT.limit} requests per window`, async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nobody@example.com' });

    for (let i = 0; i < PASSWORD_RESET_LIMIT.limit; i++) {
      const res = await attempt();
      expect(res.status).toBe(201);
    }

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
  });

  it('sets security headers from helmet', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
