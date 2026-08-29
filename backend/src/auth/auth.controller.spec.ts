import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
    loginWithGoogle: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      loginWithGoogle: jest.fn(),
    };

    controller = new AuthController(authService as unknown as AuthService);
  });

  it('delegates registration to AuthService', async () => {
    const dto = { email: 'test@example.com', password: 'password123' };
    const expected = { id: 'user-1', email: dto.email };
    authService.register.mockResolvedValue(expected);

    const result = await controller.register(dto);

    expect(authService.register).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('delegates login to AuthService', async () => {
    const dto = { email: 'test@example.com', password: 'password123' };
    const expected = { accessToken: 'token', user: { id: 'user-1' } };
    authService.login.mockResolvedValue(expected);

    const result = await controller.login(dto);

    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('delegates forgotPassword to AuthService', async () => {
    const dto = { email: 'test@example.com' };
    const expected = {
      message:
        'If an account exists for that email, a password reset link has been sent.',
    };
    authService.forgotPassword.mockResolvedValue(expected);

    const result = await controller.forgotPassword(dto);

    expect(authService.forgotPassword).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('delegates resetPassword to AuthService', async () => {
    const dto = { token: 'raw-token', password: 'newPassword123' };
    const expected = {
      message: 'Your password has been reset. You can now log in.',
    };
    authService.resetPassword.mockResolvedValue(expected);

    const result = await controller.resetPassword(dto);

    expect(authService.resetPassword).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('delegates googleLogin to AuthService', async () => {
    const dto = { accessToken: 'google-access-token' };
    const expected = { accessToken: 'token', user: { id: 'user-1' } };
    authService.loginWithGoogle.mockResolvedValue(expected);

    const result = await controller.googleLogin(dto);

    expect(authService.loginWithGoogle).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });
});
