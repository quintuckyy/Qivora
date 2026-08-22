import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

function createExecutionContext(headers: Record<string, string> = {}) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers,
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    guard = new JwtAuthGuard(jwtService as unknown as JwtService);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('throws UnauthorizedException when no Bearer token is present', async () => {
    const { context } = createExecutionContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the authorization scheme is not Bearer', async () => {
    const { context } = createExecutionContext({
      authorization: 'Basic sometoken',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when the token is invalid or expired', async () => {
    const { context } = createExecutionContext({
      authorization: 'Bearer invalid-token',
    });
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows the request and attaches the decoded payload to request.user for a valid token', async () => {
    const { context, request } = createExecutionContext({
      authorization: 'Bearer valid-token',
    });
    const payload = { sub: 'user-1', email: 'test@example.com', role: 'USER' };
    jwtService.verifyAsync.mockResolvedValue(payload);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual(payload);
  });
});
