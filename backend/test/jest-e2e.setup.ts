import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../.env.test') });

if (!process.env.DATABASE_URL_TEST) {
  throw new Error(
    'DATABASE_URL_TEST must be set to run e2e tests. Create backend/.env.test (see backend/.env.test).',
  );
}

if (!/_test(\?|$)/.test(process.env.DATABASE_URL_TEST)) {
  throw new Error(
    'DATABASE_URL_TEST must point at a database whose name ends in "_test" as a safety check against running e2e tests against a non-test database.',
  );
}

// PrismaService and prisma.config.ts both read DATABASE_URL directly. Overriding it here,
// before any module is compiled, ensures every e2e run targets the test database only.
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.NODE_ENV = 'test';

// The suites hammer auth endpoints far faster than any human; rate limiting is
// off by default for e2e and turned back on only by the dedicated throttle spec.
process.env.THROTTLE_ENABLED = 'false';
