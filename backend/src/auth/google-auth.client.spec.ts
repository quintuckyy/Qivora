import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthClient } from './google-auth.client';

describe('GoogleAuthClient', () => {
  let client: GoogleAuthClient;
  let config: { get: jest.Mock };
  const originalFetch = global.fetch;

  beforeEach(() => {
    config = { get: jest.fn().mockReturnValue('configured-client-id') };
    client = new GoogleAuthClient(config as unknown as ConfigService);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws when GOOGLE_CLIENT_ID is not configured', async () => {
    config.get.mockReturnValue(undefined);

    await expect(client.verifyAccessToken('some-token')).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns the profile for a token issued to this app with a verified email', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          aud: 'configured-client-id',
          sub: 'google-sub-1',
          email: 'test@example.com',
          email_verified: true,
        }),
    });

    const result = await client.verifyAccessToken('valid-token');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://oauth2.googleapis.com/tokeninfo?access_token=valid-token',
      ),
    );
    expect(result).toEqual({ sub: 'google-sub-1', email: 'test@example.com' });
  });

  it('accepts a token whose azp (not aud) matches this app’s client id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          azp: 'configured-client-id',
          sub: 'google-sub-1',
          email: 'test@example.com',
          email_verified: 'true',
        }),
    });

    const result = await client.verifyAccessToken('valid-token');
    expect(result.email).toBe('test@example.com');
  });

  it('rejects a token issued to a different OAuth client', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          aud: 'someone-elses-client-id',
          sub: 'google-sub-1',
          email: 'test@example.com',
          email_verified: true,
        }),
    });

    await expect(client.verifyAccessToken('replayed-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a token with an unverified email', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          aud: 'configured-client-id',
          sub: 'google-sub-1',
          email: 'test@example.com',
          email_verified: false,
        }),
    });

    await expect(client.verifyAccessToken('valid-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when Google reports the token as invalid or expired', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

    await expect(client.verifyAccessToken('expired-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
