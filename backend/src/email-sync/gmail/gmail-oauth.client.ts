import { Injectable, InternalServerErrorException } from '@nestjs/common';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/** Read-only inbox access plus the minimum identity scopes needed to show
 * which Gmail address is connected — no gmail.modify/gmail.send, and never
 * the broad `mail.google.com` scope, so this app is structurally incapable
 * of sending, deleting, or modifying the user's email. */
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid',
].join(' ');

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

function readConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new InternalServerErrorException(
      'Gmail sync is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI).',
    );
  }

  return { clientId, clientSecret, redirectUri };
}

@Injectable()
export class GmailOAuthClient {
  buildAuthUrl(): string {
    const { clientId, redirectUri } = readConfig();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GMAIL_SCOPES,
      access_type: 'offline',
      // Forces Google to reissue a refresh_token even for a user who has
      // consented before — without this, reconnecting after a disconnect
      // would silently come back with no refresh_token at all.
      prompt: 'consent',
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const { clientId, clientSecret, redirectUri } = readConfig();

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException('Failed to exchange the Google authorization code for tokens.');
    }

    return (await response.json()) as GoogleTokenResponse;
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    const { clientId, clientSecret } = readConfig();

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new InternalServerErrorException('Failed to refresh the Gmail access token. Please reconnect Gmail.');
    }

    return (await response.json()) as GoogleTokenResponse;
  }

  async fetchConnectedEmail(accessToken: string): Promise<string> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new InternalServerErrorException('Failed to read the connected Gmail account.');
    }

    const body = (await response.json()) as { email?: string };
    if (!body.email) {
      throw new InternalServerErrorException('Google did not return an email address for this account.');
    }

    return body.email;
  }

  /** Best-effort revoke on disconnect — the row is deleted either way, this
   * just also invalidates the token on Google's side so a copy of the
   * (encrypted, now-orphaned) token can never be used even in theory. */
  async revoke(token: string): Promise<void> {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST' });
    } catch {
      // Non-fatal — disconnect proceeds regardless.
    }
  }
}
