import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { httpLoggingMiddleware } from './common/middleware/http-logging.middleware';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { parseCorsOrigins } from './common/utils/parse-cors-origins';
import { createOpenApiDocument } from './openapi/document';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);

  app.use(helmet());
  // Express sets this by default; remove implementation fingerprint
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.getInstance().disable('x-powered-by');
  app.use(compression({ threshold: 1024 }));
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.use(requestIdMiddleware);
  app.use(httpLoggingMiddleware);

  const apiPrefix = config.get<string>('app.apiPrefix', 'api');
  app.setGlobalPrefix(apiPrefix);

  app.enableCors({
    origin: parseCorsOrigins(config.get<string>('app.corsOrigin')),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const document = createOpenApiDocument(app);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
  });

  app.enableShutdownHooks();

  const port = config.get<number>('app.port', 3000);
  await app.listen(port);
}

void bootstrap();
