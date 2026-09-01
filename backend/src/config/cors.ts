import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/**
 * CORS is an allowlist keyed on the browser's `Origin` header.
 *
 * `FRONTEND_ORIGIN` is a comma-separated list of every origin allowed to call
 * this API from a browser:
 *   - the deployed web app's origin (e.g. https://app.qivora.com)
 *   - the published browser extension's origin
 *     (chrome-extension://<published-id>) — see extension/README.md
 *
 * Outside production, any `chrome-extension://` origin is also accepted because
 * an unpacked extension's id changes on every reload; in production only the
 * exact origins in `FRONTEND_ORIGIN` get through.
 *
 * With no `FRONTEND_ORIGIN` set: development stays open (any origin), production
 * stays fully closed (fail safe — a misconfigured deploy blocks browsers rather
 * than allowing everyone).
 */
export function parseAllowedOrigins(value: string | undefined): string[] {
  return (
    value
      ?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []
  );
}

export interface OriginPolicy {
  allowedOrigins: string[];
  isProduction: boolean;
}

export function isOriginAllowed(
  origin: string | undefined,
  { allowedOrigins, isProduction }: OriginPolicy,
): boolean {
  // No Origin header: non-browser callers (curl, server-to-server, health
  // checks). CORS is a browser protection; these are unaffected either way.
  if (!origin) return true;

  if (allowedOrigins.includes(origin)) return true;

  // Unpacked-extension ids are regenerated on every reload, so pinning one in
  // FRONTEND_ORIGIN is pointless during development. In production the exact
  // chrome-extension://<published-id> origin must be listed explicitly.
  if (!isProduction && origin.startsWith('chrome-extension://')) return true;

  // Nothing configured: open in dev, closed in prod.
  if (allowedOrigins.length === 0) return !isProduction;

  return false;
}

export function buildCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  const policy: OriginPolicy = {
    allowedOrigins: parseAllowedOrigins(env.FRONTEND_ORIGIN),
    isProduction: env.NODE_ENV === 'production',
  };

  return {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => callback(null, isOriginAllowed(origin, policy)),
  };
}
