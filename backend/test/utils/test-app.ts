import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { cleanDatabase } from './db';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const prisma = app.get(PrismaService);

  return { app, prisma };
}

export async function closeTestApp({ app, prisma }: TestApp): Promise<void> {
  await cleanDatabase(prisma);
  await app.close();
}
