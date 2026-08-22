import { AppController } from './app.controller';
import { PrismaService } from './database/prisma.service';
import { Role } from './generated/prisma/enums';

describe('AppController', () => {
  let appController: AppController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(() => {
    prisma = { $queryRaw: jest.fn() };
    appController = new AppController(prisma as unknown as PrismaService);
  });

  describe('health', () => {
    it('returns API health status after checking database connectivity', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await appController.health();

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          status: 'ok',
          database: 'connected',
        }),
      );
      expect(typeof result.timestamp).toBe('string');
      expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('protectedRoute', () => {
    it('returns the authenticated user attached by the guard', () => {
      const user = { sub: 'user-1', email: 'test@example.com', role: Role.USER };

      const result = appController.protectedRoute(user);

      expect(result).toEqual({
        message: 'You are authenticated',
        user,
      });
    });
  });

  describe('adminRoute', () => {
    it('returns an admin access message', () => {
      const result = appController.adminRoute();

      expect(result).toEqual({ message: 'Admin access granted' });
    });
  });
});
