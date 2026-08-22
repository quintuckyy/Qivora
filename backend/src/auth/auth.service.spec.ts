import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { JwtService } from '@nestjs/jwt';

jest.mock('argon2');

const mockedArgon2 = argon2 as jest.Mocked<typeof argon2>;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let jwtService: {
    signAsync: jest.Mock;
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
      },
    };
    jwtService = {
      signAsync: jest.fn(),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwtService as unknown as JwtService,
    );

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('hashes the password and creates a new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      mockedArgon2.hash.mockResolvedValue('hashed-password' as never);
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
      mockedArgon2.verify.mockResolvedValue(true as never);
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
      mockedArgon2.verify.mockResolvedValue(false as never);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
