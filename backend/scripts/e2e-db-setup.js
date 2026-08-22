const { config } = require('dotenv');
const path = require('node:path');
const { execSync } = require('node:child_process');

config({ path: path.resolve(__dirname, '../.env.test') });

const testUrl = process.env.DATABASE_URL_TEST;

if (!testUrl) {
  console.error(
    'DATABASE_URL_TEST is not set. Create backend/.env.test with DATABASE_URL_TEST defined ' +
      '(see backend/.env.test for the expected format).',
  );
  process.exit(1);
}

execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  env: { ...process.env, DATABASE_URL: testUrl },
});
