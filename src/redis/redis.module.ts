import { Global, Logger, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT } from './redis.constants';

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
            `Redis unavailable at startup: ${err instanceof Error ? err.message : err}. OTP/cache will degrade until Redis is reachable.`,
          );
        }

        return client;
      },
    },
    CacheService,
  ],
  exports: [REDIS_CLIENT, CacheService],
})
export class RedisModule implements OnModuleDestroy {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    try {
      if (this.redis.status === 'ready' || this.redis.status === 'connecting') {
        await this.redis.quit();
        this.logger.log('Redis connection closed');
      } else {
        this.redis.disconnect();
      }
    } catch (err) {
      this.logger.warn(
        `Redis shutdown: ${err instanceof Error ? err.message : err}`,
      );
      this.redis.disconnect();
    }
  }
}
