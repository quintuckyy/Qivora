import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: jest.Mock;
    login: jest.Mock;
  };

  beforeEach(() => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
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
});
