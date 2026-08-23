import { api, ApiError } from './api-client';

export interface StoredUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface Session {
  token: string;
  user: StoredUser;
}

const STORAGE_KEY = 'jobtracker.extension.auth';

/**
 * The extension can't read the web app's localStorage — that's a different
 * origin, and browsers don't let one site's storage leak into another,
 * extensions included. So it keeps its own session, in chrome.storage.local
 * (extension-private, not reachable by any web page), obtained by logging in
 * against the same /auth/login endpoint the web app uses. Same accounts,
 * same tokens, just a separate session — this is the standard pattern real
 * "save to X" extensions use for their own backends.
 */
export async function getSession(): Promise<Session | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as Session | undefined) ?? null;
}

async function setSession(session: Session): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await api.post<{ accessToken: string; user: StoredUser }>('/auth/login', {
    email,
    password,
  });
  const session: Session = { token: response.accessToken, user: response.user };
  await setSession(session);
  return session;
}

/** Confirms a stored token still works by hitting the existing /protected
 * route, rather than just trusting whatever's in storage until a save fails. */
export async function isSessionValid(token: string): Promise<boolean> {
  try {
    await api.get('/protected', token);
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return false;
    // Network/other errors: don't log the user out over a connectivity blip.
    return true;
  }
}
