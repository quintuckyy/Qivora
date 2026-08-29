import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let config: { get: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    config = { get: jest.fn() };
    service = new MailService(config as unknown as ConfigService);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('does not call the mail API and does not throw when unconfigured', async () => {
    config.get.mockReturnValue(undefined);

    await expect(
      service.sendPasswordResetEmail(
        'user@example.com',
        'http://localhost:5173/reset-password?token=abc',
      ),
    ).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls the Brevo API with the reset link when configured', async () => {
    config.get.mockImplementation(
      (key: string) =>
        ({
          BREVO_API_KEY: 'test-key',
          MAIL_FROM: 'Qivora <noreply@qivora.example>',
        })[key],
    );
    fetchMock.mockResolvedValue({ ok: true, status: 201 });

    await service.sendPasswordResetEmail(
      'user@example.com',
      'http://localhost:5173/reset-password?token=abc',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('test-key');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.to).toEqual([{ email: 'user@example.com' }]);
    expect(body.sender).toEqual({
      email: 'noreply@qivora.example',
      name: 'Qivora',
    });
    expect(body.subject).toBe('Reset your Qivora password');
    expect(body.htmlContent).toContain(
      'http://localhost:5173/reset-password?token=abc',
    );
  });

  // MAIL_FROM is documented to also accept a bare email address (no display
  // name) — Brevo still needs a {sender: {email}} object either way.
  it('accepts MAIL_FROM as a bare email address with no display name', async () => {
    config.get.mockImplementation(
      (key: string) =>
        ({
          BREVO_API_KEY: 'test-key',
          MAIL_FROM: 'noreply@qivora.example',
        })[key],
    );
    fetchMock.mockResolvedValue({ ok: true, status: 201 });

    await service.sendPasswordResetEmail(
      'user@example.com',
      'http://localhost:5173/reset-password?token=abc',
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.sender).toEqual({ email: 'noreply@qivora.example' });
  });

  it('does not throw when the mail API call fails', async () => {
    config.get.mockImplementation(
      (key: string) =>
        ({
          BREVO_API_KEY: 'test-key',
          MAIL_FROM: 'Qivora <noreply@qivora.example>',
        })[key],
    );
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: () =>
        Promise.resolve('{"code":"invalid_parameter","message":"bad sender"}'),
    });

    await expect(
      service.sendPasswordResetEmail(
        'user@example.com',
        'http://localhost:5173/reset-password?token=abc',
      ),
    ).resolves.toBeUndefined();
  });

  it('does not throw when fetch itself rejects (network error)', async () => {
    config.get.mockImplementation(
      (key: string) =>
        ({
          BREVO_API_KEY: 'test-key',
          MAIL_FROM: 'Qivora <noreply@qivora.example>',
        })[key],
    );
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(
      service.sendPasswordResetEmail(
        'user@example.com',
        'http://localhost:5173/reset-password?token=abc',
      ),
    ).resolves.toBeUndefined();
  });
});
