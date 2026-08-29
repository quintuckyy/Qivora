import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthClient } from './google-auth.client';

jest.mock('argon2');

const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    passwordResetToken: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
  };
  let mailService: {
    sendPasswordResetEmail: jest.Mock;
  };
  let config: {
    get: jest.Mock;
  };
  let googleAuthClient: {
    verifyAccessToken: jest.Mock;
  };

  const baseUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    role: 'USER',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      passwordResetToken: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      // Mirrors Prisma's array-form $transaction: just await every operation
      // in order, same as the real thing would (each arg is already a
      // pending Prisma promise from the mocked calls above).
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    jwtService = {
      signAsync: jest.fn(),
    };
    mailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };
    config = {
      get: jest.fn().mockReturnValue(undefined),
    };
    googleAuthClient = {
      verifyAccessToken: jest.fn(),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
      mailService as unknown as MailService,
      config as unknown as ConfigService,
      googleAuthClient as unknown as GoogleAuthClient,
    );

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('hashes the password and creates a new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockedArgon2.hash.mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue({
        id: baseUser.id,
        email: baseUser.email,
        firstName: baseUser.firstName,
        lastName: baseUser.lastName,
        role: baseUser.role,
        createdAt: baseUser.createdAt,
      });

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(mockedArgon2.hash).toHaveBeenCalledWith('password123');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          passwordHash: 'hashed-password',
          firstName: 'Test',
          lastName: 'User',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@example.com');
    });

    it('throws ConflictException when the email is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(mockedArgon2.hash).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns an access token and user details on successful login', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      mockedArgon2.verify.mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('signed-jwt-token');

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockedArgon2.verify).toHaveBeenCalledWith(
        baseUser.passwordHash,
        'password123',
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: baseUser.id,
        email: baseUser.email,
        role: baseUser.role,
      });
      expect(result).toEqual({
        accessToken: 'signed-jwt-token',
        user: {
          id: baseUser.id,
          email: baseUser.email,
          firstName: baseUser.firstName,
          lastName: baseUser.lastName,
          role: baseUser.role,
        },
      });
    });

    it('throws UnauthorizedException when the email does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'missing@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockedArgon2.verify).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the password is invalid', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      mockedArgon2.verify.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    const genericResponse = {
      message:
        'If an account exists for that email, a password reset link has been sent.',
    };

    it('creates a reset token and emails it for a known email', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({});
      config.get.mockReturnValue('http://localhost:5173');

      const result = await service.forgotPassword({ email: baseUser.email });

      expect(result).toEqual(genericResponse);
      // Any previously-issued token for this user is invalidated by a fresh request.
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: baseUser.id },
      });

      expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.passwordResetToken.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe(baseUser.id);
      // Only a hash is ever stored — never the raw token itself.
      expect(createCall.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(createCall.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(createCall.data.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + 30 * 60 * 1000,
      );

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const [to, resetUrl] = mailService.sendPasswordResetEmail.mock.calls[0];
      expect(to).toBe(baseUser.email);
      expect(resetUrl).toMatch(
        /^http:\/\/localhost:5173\/reset-password\?token=.+$/,
      );
    });

    // Regression: the whole point of this endpoint's generic response is to
    // prevent email enumeration — an unknown email must be indistinguishable
    // from a known one at the HTTP layer.
    it('returns the identical generic response for an unknown email, without creating a token or sending mail', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'nobody@example.com',
      });

      expect(result).toEqual(genericResponse);
      expect(prisma.passwordResetToken.deleteMany).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('falls back to a default origin when FRONTEND_ORIGIN is not configured', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);
      prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({});
      config.get.mockReturnValue(undefined);

      await service.forgotPassword({ email: baseUser.email });

      const [, resetUrl] = mailService.sendPasswordResetEmail.mock.calls[0];
      expect(resetUrl).toMatch(
        /^http:\/\/localhost:5173\/reset-password\?token=.+$/,
      );
    });
  });

  describe('resetPassword', () => {
    const validToken = {
      id: 'reset-1',
      userId: baseUser.id,
      tokenHash: 'irrelevant-in-this-mock',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      usedAt: null,
    };

    it('updates the password, consumes the token, and clears other outstanding tokens', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validToken);
      prisma.user.findUnique.mockResolvedValue(baseUser);
      mockedArgon2.verify.mockResolvedValue(false);
      mockedArgon2.hash.mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue({});
      prisma.passwordResetToken.update.mockResolvedValue({});
      prisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.resetPassword({
        token: 'raw-token',
        password: 'newPassword123',
      });

      expect(result).toEqual({
        message: 'Your password has been reset. You can now log in.',
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: baseUser.id },
      });
      expect(mockedArgon2.verify).toHaveBeenCalledWith(
        baseUser.passwordHash,
        'newPassword123',
      );
      expect(mockedArgon2.hash).toHaveBeenCalledWith('newPassword123');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { passwordHash: 'new-hashed-password' },
      });
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: validToken.id },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: baseUser.id, id: { not: validToken.id } },
      });
    });

    // Regression: resetting to the exact same password shouldn't silently
    // "succeed" at nothing — it should tell the user plainly.
    it('rejects when the new password is the same as the current password', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validToken);
      prisma.user.findUnique.mockResolvedValue(baseUser);
      mockedArgon2.verify.mockResolvedValue(true);

      await expect(
        service.resetPassword({
          token: 'raw-token',
          password: 'sameAsCurrentPassword123',
        }),
      ).rejects.toThrow(
        'New password must be different from your current password.',
      );

      expect(mockedArgon2.hash).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.update).not.toHaveBeenCalled();
    });

    it('rejects with the generic invalid-token message if the token points at a user that no longer exists', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validToken);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'raw-token',
          password: 'newPassword123',
        }),
      ).rejects.toThrow(
        'This password reset link is invalid or has expired. Please request a new one.',
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword({ token: 'bogus', password: 'newPassword123' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword({
          token: 'raw-token',
          password: 'newPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    // Regression: a token must not work a second time after it has already
    // reset a password once.
    it('rejects a token that was already used', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validToken,
        usedAt: new Date(),
      });

      await expect(
        service.resetPassword({
          token: 'raw-token',
          password: 'newPassword123',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('gives the same error message for an unknown, expired, and already-used token', async () => {
      const message =
        'This password reset link is invalid or has expired. Please request a new one.';

      prisma.passwordResetToken.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.resetPassword({ token: 'a', password: 'newPassword123' }),
      ).rejects.toThrow(message);

      prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        ...validToken,
        expiresAt: new Date(Date.now() - 1),
      });
      await expect(
        service.resetPassword({ token: 'b', password: 'newPassword123' }),
      ).rejects.toThrow(message);

      prisma.passwordResetToken.findUnique.mockResolvedValueOnce({
        ...validToken,
        usedAt: new Date(),
      });
      await expect(
        service.resetPassword({ token: 'c', password: 'newPassword123' }),
      ).rejects.toThrow(message);
    });
  });

  describe('loginWithGoogle', () => {
    const googleProfile = { sub: 'google-sub-1', email: 'test@example.com' };

    it('logs in an existing user matched by email, without creating a new one', async () => {
      googleAuthClient.verifyAccessToken.mockResolvedValue(googleProfile);
      prisma.user.findUnique.mockResolvedValue(baseUser);
      jwtService.signAsync.mockResolvedValue('signed-jwt-token');

      const result = await service.loginWithGoogle({
        accessToken: 'google-access-token',
      });

      expect(googleAuthClient.verifyAccessToken).toHaveBeenCalledWith(
        'google-access-token',
      );
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: googleProfile.email },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: baseUser.id,
        email: baseUser.email,
        role: baseUser.role,
      });
      expect(result).toEqual({
        accessToken: 'signed-jwt-token',
        user: {
          id: baseUser.id,
          email: baseUser.email,
          firstName: baseUser.firstName,
          lastName: baseUser.lastName,
          role: baseUser.role,
        },
      });
    });

    it('auto-registers a new user on first Google sign-in, with an unusable random password', async () => {
      googleAuthClient.verifyAccessToken.mockResolvedValue(googleProfile);
      prisma.user.findUnique.mockResolvedValue(null);
      mockedArgon2.hash.mockResolvedValue('random-unusable-hash');
      prisma.user.create.mockResolvedValue({
        ...baseUser,
        firstName: null,
        lastName: null,
      });
      jwtService.signAsync.mockResolvedValue('signed-jwt-token');

      const result = await service.loginWithGoogle({
        accessToken: 'google-access-token',
      });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.user.create.mock.calls[0][0];
      expect(createCall.data.email).toBe(googleProfile.email);
      expect(createCall.data.passwordHash).toBe('random-unusable-hash');
      // The password handed to argon2 is a fresh random token, never a
      // guessable/derivable value (e.g. not based on the Google sub or email).
      expect(mockedArgon2.hash).toHaveBeenCalledWith(
        expect.not.stringContaining(googleProfile.email),
      );
      expect(result.accessToken).toBe('signed-jwt-token');
    });

    it('propagates rejection from an unverified or invalid Google token without touching the database', async () => {
      googleAuthClient.verifyAccessToken.mockRejectedValue(
        new UnauthorizedException('nope'),
      );

      await expect(
        service.loginWithGoogle({ accessToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
