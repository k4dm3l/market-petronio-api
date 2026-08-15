import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const apiPrefix = config.get<string>('app.apiPrefix', 'api');
  app.setGlobalPrefix(apiPrefix);

  app.enableCors({
    origin: config.get<string>('app.corsOrigin', 'http://localhost:3001'),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Market Petronio API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth', 'Registration, login, token refresh, and password recovery')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();

  const port = config.get<number>('app.port', 3000);
  await app.listen(port);
}

void bootstrap();
