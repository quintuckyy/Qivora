import { InternalServerErrorException } from '@nestjs/common';
import { GmailOAuthClient, GmailReauthRequiredError } from './gmail-oauth.client';

function mockFetchOnce(status: number, body: unknown): jest.Mock {
  const mock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

describe('GmailOAuthClient', () => {
  let client: GmailOAuthClient;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:5173/email-sync';
    client = new GmailOAuthClient();
  });

  describe('refreshAccessToken', () => {
    it('resolves with the refreshed tokens on success', async () => {
      mockFetchOnce(200, {
        access_token: 'new-access-token',
        expires_in: 3600,
        scope: 'gmail.readonly',
        token_type: 'Bearer',
      });

      await expect(client.refreshAccessToken('refresh-token')).resolves.toEqual(
        expect.objectContaining({ access_token: 'new-access-token' }),
      );
    });

    // Regression: a revoked/expired refresh token must be told apart from a
    // transient failure, so the automatic sync job can stop retrying it
    // instead of hitting Google on every tick with a call that can only
    // ever fail the same way.
    it('throws GmailReauthRequiredError when Google reports invalid_grant', async () => {
      mockFetchOnce(400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });

      await expect(client.refreshAccessToken('revoked-refresh-token')).rejects.toThrow(GmailReauthRequiredError);
    });

    it('throws a generic error for a transient failure unrelated to the grant', async () => {
      mockFetchOnce(503, { error: 'temporarily_unavailable' });

      await expect(client.refreshAccessToken('refresh-token')).rejects.toThrow(InternalServerErrorException);
    });

    it('throws a generic error when the failure response has no parseable body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('not json')),
      }) as unknown as typeof fetch;

      await expect(client.refreshAccessToken('refresh-token')).rejects.toThrow(InternalServerErrorException);
    });
  });
});
