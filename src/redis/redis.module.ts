import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const logger = new Logger('RedisModule');
        const url = config.get<string>('redis.url', 'redis://127.0.0.1:6379');

        const client = new Redis(url, {
          maxRetriesPerRequest: 1,
          connectTimeout: 5000,
          enableOfflineQueue: false,
          lazyConnect: true,
          retryStrategy: (times) => {
            if (times > 3) return null;
            return Math.min(times * 200, 1000);
          },
        });

        client.on('error', (err) => {
          logger.warn(`Redis error: ${err.message}`);
        });

        try {
          await Promise.race([
            client.connect(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Redis connect timeout')), 5000),
            ),
          ]);
          logger.log('Redis connected');
        } catch (err) {
          logger.error(
            `Redis unavailable at startup: ${err instanceof Error ? err.message : err}. Password recovery will fail until Redis is reachable.`,
          );
        }

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
