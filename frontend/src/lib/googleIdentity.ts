// Thin wrapper around Google Identity Services' OAuth2 "token client" — the
// piece that lets our own custom-styled button (rather than Google's
// rendered iframe button, which can't be triggered programmatically) open
// the real Google consent popup and hand back an access token on success.
// The script itself is loaded once, globally, via the <script> tag in
// index.html; this module just waits for it to be ready.

type TokenClientResponse = { access_token: string } | { error: string };

interface GoogleTokenClient {
  requestAccessToken: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenClientResponse) => void;
            error_callback?: (error: { type: string }) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

const SCOPE = 'openid email profile';

function waitForGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      if (Date.now() - start > 10000) {
        reject(new Error('Google sign-in failed to load. Please refresh and try again.'));
        return;
      }
      setTimeout(check, 100);
    };
    check();
  });
}

export function isGoogleSignInConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
}

/** Opens Google's account picker/consent popup and resolves with an access
 * token on success. Rejects — never resolves with a placeholder token — if
 * the user closes the popup, denies access, or the client isn't configured
 * or never finished loading. */
export async function requestGoogleAccessToken(): Promise<string> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google sign-in is not configured.');
  }

  await waitForGis();

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => {
        if ('access_token' in response) {
          resolve(response.access_token);
        } else {
          reject(new Error('Google sign-in failed. Please try again.'));
        }
      },
      error_callback: (error) => {
        reject(
          new Error(error.type === 'popup_closed' ? 'Google sign-in was cancelled.' : 'Google sign-in failed.'),
        );
      },
    });

    client.requestAccessToken();
  });
}
