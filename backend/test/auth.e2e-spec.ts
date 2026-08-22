import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db';
import { uniqueEmail } from './utils/auth';
import { PrismaService } from '../src/database/prisma.service';

describe('Auth (e2e)', () => {
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

  describe('POST /auth/register', () => {
    it('registers a new user and never returns the password hash', async () => {
      const email = uniqueEmail('register');

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      expect(response.body).toEqual(
        expect.objectContaining({
          email,
          firstName: 'Test',
          lastName: 'User',
          role: 'USER',
        }),
      );
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('password');
    });

    it('rejects a duplicate email with a 409 Conflict', async () => {
      const email = uniqueEmail('dup');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'anotherPassword123' })
        .expect(409);
    });

    it('rejects an invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);
    });

    it('rejects a password shorter than the minimum length', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: uniqueEmail('short'), password: 'short' })
        .expect(400);
    });

    it('rejects unknown fields due to forbidNonWhitelisted', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: uniqueEmail('extra'),
          password: 'password123',
          isAdmin: true,
        })
        .expect(400);
    });

    it('rejects a missing required field', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ password: 'password123' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    const password = 'password123';

    it('logs in with correct credentials and returns an access token', async () => {
      const email = uniqueEmail('login');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);

      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body.accessToken.length).toBeGreaterThan(0);
      expect(response.body.user).toEqual(
        expect.objectContaining({ email, role: 'USER' }),
      );
    });

    it('rejects login for a non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: uniqueEmail('missing'), password })
        .expect(401);
    });

    it('rejects login with an incorrect password', async () => {
      const email = uniqueEmail('wrongpw');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrongPassword123' })
        .expect(401);
    });

    it('rejects a malformed login payload', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });
});
