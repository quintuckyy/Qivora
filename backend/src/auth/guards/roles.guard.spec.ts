import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../../generated/prisma/enums';

function createExecutionContext(user?: { role?: Role }) {
  return {
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createExecutionContext({ role: Role.USER });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when the user has a matching role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = createExecutionContext({ role: Role.ADMIN });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when the user role is insufficient', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = createExecutionContext({ role: Role.USER });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies access when the request has no user role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const context = createExecutionContext(undefined);

    expect(guard.canActivate(context)).toBe(false);
  });
});
