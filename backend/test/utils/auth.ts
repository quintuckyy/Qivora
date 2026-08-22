import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export interface RegisteredUser {
  accessToken: string;
  userId: string;
  email: string;
}

let counter = 0;

export function uniqueEmail(prefix = 'user'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@example.com`;
}

export async function registerAndLogin(
  app: INestApplication,
  overrides: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }> = {},
): Promise<RegisteredUser> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? 'password123';

  await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email,
      password,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? 'User',
    })
    .expect(201);

  const loginResponse = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    // AuthController has no @HttpCode override, so @Post defaults to 201.
    .expect(201);

  return {
    accessToken: loginResponse.body.accessToken,
    userId: loginResponse.body.user.id,
    email,
  };
}
