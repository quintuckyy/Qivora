import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app-setup';
import { buildCorsOptions } from './config/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors(buildCorsOptions());
  configureApp(app);
  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
