import { API_BASE_URL } from './config';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, `Could not reach the Job Tracker API at ${API_BASE_URL}. Is the backend running?`);
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      (Array.isArray(body?.message) ? body.message.join(', ') : body?.message) ??
      `Request failed with status ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string, token?: string | null) => request<T>(path, { method: 'GET' }, token),
  post: <T>(path: string, payload: unknown, token?: string | null) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(payload) }, token),
};
