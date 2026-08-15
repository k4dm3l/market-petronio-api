import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('Market Petronio API')
    .setDescription(
      'Marketplace API for cooks and customers (Buonaventura / Pacific region).',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth', 'Registration, login, token refresh, and password recovery')
    .addTag('users', 'Customer profile and default delivery information')
    .addTag(
      'products',
      'Catalog: tags, preparationTimeHours, filters, nearby search',
    )
    .addTag(
      'orders',
      'Order lifecycle including delivery snapshot on create (spec 005)',
    )
    .addTag('cooks', 'Cook profiles and dashboard')
    .addTag('categories', 'Product categories')
    .addTag('admin', 'Admin statistics and moderation')
    .addTag('notifications', 'Notification inbox')
    .addTag('health', 'Health checks')
    .build();
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, buildOpenApiConfig());
}
