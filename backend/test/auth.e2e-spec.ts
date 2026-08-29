import { INestApplication, UnauthorizedException } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, closeTestApp } from './utils/test-app';
import { cleanDatabase } from './utils/db';
import { uniqueEmail } from './utils/auth';
import { PrismaService } from '../src/database/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { GoogleAuthClient } from '../src/auth/google-auth.client';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // A real reset token only ever exists in the emailed link — the DB stores
  // just its hash, and no API response ever returns it (that's the whole
  // point of the "always generic" forgot-password response). Swapping in a
  // spy MailService is the only way to get at it from a test.
  const sentEmails: { to: string; resetUrl: string }[] = [];
  const mockMailService = {
    sendPasswordResetEmail: jest.fn(async (to: string, resetUrl: string) => {
      sentEmails.push({ to, resetUrl });
    }),
  };

  // /auth/google's real dependency is a live call to Google's tokeninfo
  // endpoint — there's no real Google access token to exercise it with in a
  // test, so this is mocked at the same seam GoogleAuthClient exposes,
  // exactly like MailService above.
  const mockGoogleAuthClient = {
    verifyAccessToken: jest.fn(),
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp((builder) =>
      builder
        .overrideProvider(MailService)
        .useValue(mockMailService)
        .overrideProvider(GoogleAuthClient)
        .useValue(mockGoogleAuthClient),
    ));
  });

  beforeEach(() => {
    sentEmails.length = 0;
    mockMailService.sendPasswordResetEmail.mockClear();
    mockGoogleAuthClient.verifyAccessToken.mockReset();
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

  function extractToken(resetUrl: string): string {
    return new URL(resetUrl).searchParams.get('token')!;
  }

  async function requestReset(email: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email })
      .expect(201);
    const sent = sentEmails[sentEmails.length - 1];
    return extractToken(sent.resetUrl);
  }

  describe('POST /auth/forgot-password', () => {
    it('returns the generic response for a registered email and sends a reset link', async () => {
      const email = uniqueEmail('forgot');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email })
        .expect(201);

      expect(response.body).toEqual({
        message:
          'If an account exists for that email, a password reset link has been sent.',
      });
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].to).toBe(email);
      expect(sentEmails[0].resetUrl).toContain('/reset-password?token=');
    });

    // Regression: the entire purpose of this endpoint's generic response is
    // to prevent email enumeration — a registered and unregistered email
    // must be indistinguishable at the HTTP layer.
    it('returns the identical generic response for an unregistered email, without sending anything', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: uniqueEmail('unregistered') })
        .expect(201);

      expect(response.body).toEqual({
        message:
          'If an account exists for that email, a password reset link has been sent.',
      });
      expect(sentEmails).toHaveLength(0);
    });

    it('rejects a malformed email', async () => {
      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('resets the password with a valid token and allows login with the new password (not the old one)', async () => {
      const email = uniqueEmail('reset-valid');
      const oldPassword = 'password123';
      const newPassword = 'brandNewPassword456';
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: oldPassword })
        .expect(201);

      const token = await requestReset(email);

      const response = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password: newPassword })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Your password has been reset. You can now log in.',
      });

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: oldPassword })
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: newPassword })
        .expect(201);
    });

    it('rejects resetting to the same password the account already has, without consuming the token', async () => {
      const email = uniqueEmail('reset-same');
      const password = 'password123';
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password })
        .expect(201);

      const token = await requestReset(email);

      const rejected = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password })
        .expect(400);
      expect(rejected.body.message).toBe(
        'New password must be different from your current password.',
      );

      // The token wasn't consumed by the rejected attempt — it still works
      // for an actual new password.
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password: 'aGenuinelyNewPassword456' })
        .expect(201);
    });

    it('rejects reusing an already-consumed token', async () => {
      const email = uniqueEmail('reset-reuse');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);
      const token = await requestReset(email);

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password: 'firstReset123' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password: 'secondReset123' })
        .expect(400);
    });

    it('rejects an unknown/invalid token', async () => {
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'this-token-does-not-exist', password: 'password123' })
        .expect(400);
    });

    it('rejects an expired token', async () => {
      const email = uniqueEmail('reset-expired');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);
      const token = await requestReset(email);

      // Backdate the token's expiry directly — there's no clock-mocking hook
      // in this app, so this is the direct way to exercise the expiry branch.
      await prisma.passwordResetToken.updateMany({
        where: { user: { email } },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password: 'newPassword123' })
        .expect(400);
    });

    it('invalidates a previously-issued token once a new reset is requested', async () => {
      const email = uniqueEmail('reset-superseded');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      const firstToken = await requestReset(email);
      const secondToken = await requestReset(email);

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: firstToken, password: 'newPassword123' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: secondToken, password: 'newPassword123' })
        .expect(201);
    });

    it('rejects a password shorter than the minimum length', async () => {
      const email = uniqueEmail('reset-short');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);
      const token = await requestReset(email);

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token, password: 'short' })
        .expect(400);
    });
  });

  describe('POST /auth/google', () => {
    it('auto-registers a new user on first Google sign-in and returns a usable access token', async () => {
      const email = uniqueEmail('google-new');
      mockGoogleAuthClient.verifyAccessToken.mockResolvedValue({
        sub: 'google-sub-new',
        email,
      });

      const response = await request(app.getHttpServer())
        .post('/auth/google')
        .send({ accessToken: 'fake-google-token' })
        .expect(201);

      expect(response.body.user).toEqual(
        expect.objectContaining({ email, role: 'USER' }),
      );
      expect(typeof response.body.accessToken).toBe('string');

      const created = await prisma.user.findUnique({ where: { email } });
      expect(created).not.toBeNull();
      // A Google-only account still gets a passwordHash (schema requires
      // one) but it must never be the literal Google access token or
      // anything derived predictably from the email.
      expect(created!.passwordHash).not.toBe('fake-google-token');

      // The freshly issued token is a real, working JWT for this account.
      await request(app.getHttpServer())
        .get('/applications')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);
    });

    it('logs in an existing user matched by email instead of creating a duplicate', async () => {
      const email = uniqueEmail('google-existing');
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password: 'password123' })
        .expect(201);

      mockGoogleAuthClient.verifyAccessToken.mockResolvedValue({
        sub: 'google-sub-existing',
        email,
      });

      await request(app.getHttpServer())
        .post('/auth/google')
        .send({ accessToken: 'fake-google-token' })
        .expect(201);

      const users = await prisma.user.findMany({ where: { email } });
      expect(users).toHaveLength(1);
    });

    it('rejects when Google verification fails (invalid/expired/unverified token)', async () => {
      mockGoogleAuthClient.verifyAccessToken.mockRejectedValue(
        new UnauthorizedException(
          'Your Google session is invalid or has expired. Please try again.',
        ),
      );

      await request(app.getHttpServer())
        .post('/auth/google')
        .send({ accessToken: 'bad-token' })
        .expect(401);
    });

    it('rejects a missing accessToken', async () => {
      await request(app.getHttpServer())
        .post('/auth/google')
        .send({})
        .expect(400);
    });
  });
});
