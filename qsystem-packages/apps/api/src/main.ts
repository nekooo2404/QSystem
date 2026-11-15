import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { validateRuntimeEnv } from './config/env.config';
import { applyHttpHardening } from './common/http-hardening';

async function bootstrap(): Promise<void> {
  validateRuntimeEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  applyHttpHardening(app);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`qsystem api listening on :${port}`);
}

void bootstrap();
