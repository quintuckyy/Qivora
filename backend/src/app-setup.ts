import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

/**
 * Request-pipeline setup shared by the real server (`main.ts`) and the e2e test
 * harness, so tests exercise the same middleware and validation the deployment
 * runs.
 */
export function configureApp(app: INestApplication): void {
  // Security headers: X-Content-Type-Options: nosniff, frame-deny, HSTS (over
  // TLS), Referrer-Policy, no X-Powered-By, and more.
  app.use(
    helmet({
      // This is a JSON API with no first-party HTML in production (Swagger UI
      // is dev-only), so a page-level CSP protects nothing here — and helmet's
      // default CSP breaks the Swagger UI's inline assets. `nosniff` already
      // stops JSON being interpreted as markup.
      contentSecurityPolicy: false,
      // The SPA and the browser extension call this API from another origin;
      // CORS (see buildCorsOptions) governs who may read responses. The default
      // `same-origin` CORP would additionally block legitimate cross-origin
      // resource loads (e.g. an <embed>/<iframe> pointed at a résumé file).
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}

/**
 * Whether the Swagger UI (`/api/docs`) should be mounted.
 *
 * Development: on. Production: off, unless `ENABLE_SWAGGER=true` is set
 * explicitly. `ENABLE_SWAGGER=false` forces it off in any environment.
 */
export function shouldServeSwagger(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.ENABLE_SWAGGER === 'true') return true;
  if (env.ENABLE_SWAGGER === 'false') return false;
  return env.NODE_ENV !== 'production';
}

export function setupSwagger(
  app: INestApplication,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!shouldServeSwagger(env)) return false;

  const config = new DocumentBuilder()
    .setTitle('Qivora API')
    .setDescription(
      'API for managing job applications, interviews, notes, resumes, application history, and analytics.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  return true;
}
