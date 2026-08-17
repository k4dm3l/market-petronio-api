import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Cache helper over Redis. Failures are swallowed so MongoDB remains source of truth.
 * Key namespace: `cache:{resource}:...` (separate from OTP keys).
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  ttlSeconds(resource: 'categories' | 'tags'): number {
    if (resource === 'categories') {
      return this.config.get<number>('cache.categoriesTtlSeconds', 3600);
    }
    return this.config.get<number>('cache.tagsTtlSeconds', 600);
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(
        `cache get failed for ${key}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `cache set failed for ${key}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** Bump version so prior list keys become unreachable (TTL cleans them up). */
  async invalidate(resource: 'categories' | 'tags'): Promise<void> {
    try {
      await this.redis.incr(`cache:${resource}:ver`);
    } catch (err) {
      this.logger.warn(
        `cache invalidate failed for ${resource}: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  async listKey(
    resource: 'categories' | 'tags',
    suffix: string,
  ): Promise<string> {
    let ver = '0';
    try {
      ver = (await this.redis.get(`cache:${resource}:ver`)) ?? '0';
    } catch {
      /* miss → unversioned key still ok for this request */
    }
    return `cache:${resource}:v${ver}:${suffix}`;
  }
}
