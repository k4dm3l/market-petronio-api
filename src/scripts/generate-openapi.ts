import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { createOpenApiDocument } from '../openapi/document';

/** Placeholders so ConfigModule Joi validation passes without a real .env */
function ensureEnvDefaults() {
  process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/market-petronio-openapi';
  process.env.JWT_SECRET ??= 'openapi-generate-jwt-secret-min-32-chars!!';
  process.env.JWT_REFRESH_SECRET ??=
    'openapi-generate-refresh-secret-min-32!!!';
  process.env.API_PREFIX ??= 'api';
}

async function generate() {
  ensureEnvDefaults();

  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: ['error'],
  });

  app.setGlobalPrefix(process.env.API_PREFIX ?? 'api');

  const document = createOpenApiDocument(app);
  const outDir = join(process.cwd(), 'docs');
  const outFile = join(outDir, 'openapi.json');

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();
  console.log(`OpenAPI written to ${outFile}`);
}

void generate().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
