import {
  AUTH_LIMIT,
  GLOBAL_LIMIT,
  PASSWORD_RESET_LIMIT,
  buildThrottlerOptions,
  throttlingEnabled,
} from './throttling';

describe('throttling limits', () => {
  it('keeps the global ceiling well above realistic app usage', () => {
    expect(GLOBAL_LIMIT).toEqual({ limit: 300, ttl: 60_000 });
  });

  it('rate-limits credential endpoints to 10 / minute', () => {
    expect(AUTH_LIMIT).toEqual({ limit: 10, ttl: 60_000 });
  });

  it('rate-limits password-reset requests to 5 / 15 minutes', () => {
    expect(PASSWORD_RESET_LIMIT).toEqual({ limit: 5, ttl: 900_000 });
  });
});

describe('throttlingEnabled', () => {
  it('is enabled by default', () => {
    expect(throttlingEnabled({} as NodeJS.ProcessEnv)).toBe(true);
  });

  it('is disabled only by the explicit THROTTLE_ENABLED=false opt-out', () => {
    expect(throttlingEnabled({ THROTTLE_ENABLED: 'false' } as NodeJS.ProcessEnv)).toBe(false);
    expect(throttlingEnabled({ THROTTLE_ENABLED: 'true' } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe('buildThrottlerOptions', () => {
  const original = process.env.THROTTLE_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.THROTTLE_ENABLED;
    else process.env.THROTTLE_ENABLED = original;
  });

  it('registers a single named "default" throttler at the global limit', () => {
    const options = buildThrottlerOptions();
    expect(options.throttlers).toEqual([{ name: 'default', limit: 300, ttl: 60_000 }]);
  });

  it('skips enforcement when throttling is disabled', () => {
    process.env.THROTTLE_ENABLED = 'false';
    const options = buildThrottlerOptions();
    expect(options.skipIf?.({} as never)).toBe(true);
  });

  it('enforces when throttling is enabled', () => {
    process.env.THROTTLE_ENABLED = 'true';
    const options = buildThrottlerOptions();
    expect(options.skipIf?.({} as never)).toBe(false);
  });
});
