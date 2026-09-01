import { isOriginAllowed, parseAllowedOrigins, buildCorsOptions } from './cors';

describe('parseAllowedOrigins', () => {
  it('splits, trims, and drops empty entries', () => {
    expect(
      parseAllowedOrigins('https://app.qivora.com, chrome-extension://abc ,, '),
    ).toEqual(['https://app.qivora.com', 'chrome-extension://abc']);
  });

  it('returns an empty list when unset', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });
});

describe('isOriginAllowed', () => {
  const prod = { allowedOrigins: ['https://app.qivora.com'], isProduction: true };

  it('always allows a request with no Origin header (non-browser caller)', () => {
    expect(isOriginAllowed(undefined, prod)).toBe(true);
  });

  it('allows an exact configured origin in production', () => {
    expect(isOriginAllowed('https://app.qivora.com', prod)).toBe(true);
  });

  it('blocks an unlisted origin in production', () => {
    expect(isOriginAllowed('https://evil.example', prod)).toBe(false);
  });

  it('blocks arbitrary chrome-extension origins in production', () => {
    expect(isOriginAllowed('chrome-extension://unpinned', prod)).toBe(false);
  });

  it('allows the published extension origin in production when explicitly listed', () => {
    expect(
      isOriginAllowed('chrome-extension://published-id', {
        allowedOrigins: ['https://app.qivora.com', 'chrome-extension://published-id'],
        isProduction: true,
      }),
    ).toBe(true);
  });

  it('allows any chrome-extension origin outside production', () => {
    expect(
      isOriginAllowed('chrome-extension://reloads-every-time', {
        allowedOrigins: ['http://localhost:5173'],
        isProduction: false,
      }),
    ).toBe(true);
  });

  it('is fully open in development when nothing is configured', () => {
    expect(
      isOriginAllowed('https://anything.example', { allowedOrigins: [], isProduction: false }),
    ).toBe(true);
  });

  it('is fully closed in production when nothing is configured (fail safe)', () => {
    expect(
      isOriginAllowed('https://app.qivora.com', { allowedOrigins: [], isProduction: true }),
    ).toBe(false);
  });
});

describe('buildCorsOptions', () => {
  it('reflects an allowed origin through the callback', () => {
    const options = buildCorsOptions({
      NODE_ENV: 'production',
      FRONTEND_ORIGIN: 'https://app.qivora.com',
    } as NodeJS.ProcessEnv);

    const originFn = options.origin as (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => void;

    const allowed = jest.fn();
    originFn('https://app.qivora.com', allowed);
    expect(allowed).toHaveBeenCalledWith(null, true);

    const blocked = jest.fn();
    originFn('https://evil.example', blocked);
    expect(blocked).toHaveBeenCalledWith(null, false);
  });
});
