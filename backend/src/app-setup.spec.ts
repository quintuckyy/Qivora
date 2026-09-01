import { shouldServeSwagger } from './app-setup';

describe('shouldServeSwagger', () => {
  it('serves docs in development', () => {
    expect(shouldServeSwagger({} as NodeJS.ProcessEnv)).toBe(true);
    expect(shouldServeSwagger({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('does not serve docs in production by default', () => {
    expect(shouldServeSwagger({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('serves docs in production only when ENABLE_SWAGGER=true', () => {
    expect(
      shouldServeSwagger({ NODE_ENV: 'production', ENABLE_SWAGGER: 'true' } as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('lets ENABLE_SWAGGER=false force docs off in any environment', () => {
    expect(shouldServeSwagger({ ENABLE_SWAGGER: 'false' } as NodeJS.ProcessEnv)).toBe(false);
  });
});
