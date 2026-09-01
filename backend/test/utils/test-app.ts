import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app-setup';
import { PrismaService } from '../../src/database/prisma.service';
import { cleanDatabase } from './db';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
}

/** `configure` lets a spec override a provider before the module compiles —
 * e.g. swapping MailService for a spy so a test can capture what would have
 * been emailed (a real password-reset token only ever exists in that email,
 * never in an API response or in the DB, which only stores its hash). */
export async function createTestApp(
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder,
): Promise<TestApp> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });
  if (configure) {
    builder = configure(builder);
  }
  const moduleFixture = await builder.compile();

  const app = moduleFixture.createNestApplication();

  configureApp(app);

  await app.init();

  const prisma = app.get(PrismaService);

  return { app, prisma };
}

export async function closeTestApp({ app, prisma }: TestApp): Promise<void> {
  await cleanDatabase(prisma);
  await app.close();
}
