import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Required so the frontend (served from a different origin/port) can call this API.
  // FRONTEND_ORIGIN is a comma-separated allowlist. In production, omitting it
  // disables CORS entirely (fail closed) rather than defaulting to allow-all.
  const allowedOrigins =
    process.env.FRONTEND_ORIGIN?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];
  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // No Origin header: non-browser callers (curl, health checks) — allow.
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) return callback(null, true);

      // The companion browser extension is its own origin
      // (chrome-extension://<id>), and that id is regenerated every time the
      // unpacked build is reloaded during development. Rather than chase it in
      // FRONTEND_ORIGIN, accept any extension origin outside production; in
      // production, pin the published extension id by adding its
      // chrome-extension:// origin to FRONTEND_ORIGIN.
      if (!isProduction && origin.startsWith('chrome-extension://')) {
        return callback(null, true);
      }

      // With no allowlist configured, dev stays open and prod stays closed —
      // the original fail-closed-in-production behaviour.
      if (allowedOrigins.length === 0) return callback(null, !isProduction);

      return callback(null, false);
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Job Application Tracker API')
    .setDescription(
      'Production-style API for managing job applications, interviews, notes, resumes, application history, and analytics.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(
    app,
    swaggerConfig,
  );

  SwaggerModule.setup(
    'api/docs',
    app,
    document,
  );

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();