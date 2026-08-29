import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

export interface GoogleProfile {
  sub: string;
  email: string;
}

/** Verifies the OAuth access token the frontend obtains from Google
 * Identity Services' token client — a separate, minimal `openid email`
 * grant used only to prove "I own this Google account", distinct from the
 * broader `gmail.readonly` OAuth client used elsewhere for Gmail sync (see
 * email-sync/gmail/gmail-oauth.client.ts). Sign-in never touches that
 * client or its scopes. */
@Injectable()
export class GoogleAuthClient {
  constructor(private readonly config: ConfigService) {}

  /** Asks Google directly who an access token belongs to — the token is
   * opaque to us and easy to fabricate a plausible-looking one for, so
   * trusting anything the frontend claims about it without this round trip
   * would make the endpoint worthless as authentication. */
  async verifyAccessToken(accessToken: string): Promise<GoogleProfile> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new InternalServerErrorException(
        'Google sign-in is not configured.',
      );
    }

    const response = await fetch(
      `${GOOGLE_TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`,
    );

    if (!response.ok) {
      throw new UnauthorizedException(
        'Your Google session is invalid or has expired. Please try again.',
      );
    }

    const body = (await response.json()) as {
      aud?: string;
      azp?: string;
      sub?: string;
      email?: string;
      email_verified?: string | boolean;
    };

    // The token must have been issued to *this app's* OAuth client.
    // Without this check, a valid Google access token minted for some other
    // application (which the caller could obtain for any Google account,
    // including a victim's) could be replayed here to sign in as whoever it
    // belongs to — the tokeninfo lookup alone doesn't prove that.
    if (body.aud !== clientId && body.azp !== clientId) {
      throw new UnauthorizedException(
        'This Google session was not issued for this app.',
      );
    }

    const emailVerified =
      body.email_verified === true || body.email_verified === 'true';
    if (!body.sub || !body.email || !emailVerified) {
      throw new UnauthorizedException(
        'Your Google account email is not verified.',
      );
    }

    return { sub: body.sub, email: body.email };
  }
}
