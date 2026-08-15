import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export function buildOpenApiConfig() {
  return new DocumentBuilder()
    .setTitle('Market Petronio API')
    .setDescription(
      'Marketplace API for cooks and customers (Pacific region).',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth', 'Registration, login, token refresh, and password recovery')
    .addTag('users', 'Customer profile, delivery info, and profile image uploads')
    .addTag(
      'products',
      'Catalog, filters, nearby search, and product image uploads (spec 006)',
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
