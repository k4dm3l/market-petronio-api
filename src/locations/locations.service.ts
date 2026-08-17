import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService } from '../redis/cache.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import {
  LOCATION_PROVIDER,
  LocationProvider,
} from './adapters/location-provider.interface';
import { SearchAddressQueryDto } from './dto/search-address.dto';
import {
  AddressDetails,
  LocationSearchResult,
} from './types/location.types';

const SESSION_TTL_SECONDS = 180;

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    @Inject(LOCATION_PROVIDER) private readonly provider: LocationProvider,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  async search(
    query: SearchAddressQueryDto,
    userId: string,
  ): Promise<LocationSearchResult[]> {
    const text = this.normalizeQuery(query.query);
    const cacheKey = this.searchCacheKey(text, this.geoBias(query));

    const cached = await this.cache.getJson<LocationSearchResult[]>(cacheKey);
    if (cached) return cached;

    const sessionToken = await this.peekOrCreateSession(userId);
    const data = await this.provider.searchAddresses(text, {
      sessionToken: sessionToken ?? undefined,
      ...this.geoBias(query),
    });

    const ttl = this.config.get<number>(
      'cache.locationSearchTtlSeconds',
      3600,
    );
    await this.cache.setJson(cacheKey, data, ttl);
    return data;
  }

  async getPlace(placeId: string, userId: string): Promise<AddressDetails> {
    const id = placeId.trim().replace(/^places\//, '');
    if (id.length < 3 || id.length > 256) {
      throw new BadRequestException('Invalid location search request');
    }

    const key = `cache:locations:place:${id}`;
    const cached = await this.cache.getJson<AddressDetails>(key);
    if (cached) return cached;

    const sessionToken = await this.takeSession(userId);
    const details = await this.provider.getAddressDetails(
      id,
      sessionToken ?? undefined,
    );
    const ttl = this.config.get<number>('cache.locationsTtlSeconds', 86400);
    await this.cache.setJson(key, details, ttl);
    return details;
  }

  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private geoBias(query: SearchAddressQueryDto) {
    if (query.latitude == null || query.longitude == null) return {};
    return {
      latitude: query.latitude,
      longitude: query.longitude,
      radius: query.radius,
    };
  }

  private searchCacheKey(
    query: string,
    bias: { latitude?: number; longitude?: number; radius?: number },
  ): string {
    if (bias.latitude != null && bias.longitude != null) {
      const r = bias.radius ?? 50000;
      return `cache:locations:search:${query}:${bias.latitude.toFixed(2)}:${bias.longitude.toFixed(2)}:${r}`;
    }
    return `cache:locations:search:${query}`;
  }

  /** Sliding Google Autocomplete session — not the JWT. */
  private async peekOrCreateSession(userId: string): Promise<string | null> {
    const key = `locations:session:${userId}`;
    try {
      const existing = await this.redis.get(key);
      if (existing) {
        await this.redis.expire(key, SESSION_TTL_SECONDS);
        return existing;
      }
      const token = randomUUID();
      await this.redis.set(key, token, 'EX', SESSION_TTL_SECONDS);
      return token;
    } catch (err) {
      this.logger.warn(
        `location session get/set failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return null;
    }
  }

  /** Consume session so Place Details closes Google billing session. */
  private async takeSession(userId: string): Promise<string | null> {
    const key = `locations:session:${userId}`;
    try {
      const token = await this.redis.get(key);
      if (token) await this.redis.del(key);
      return token;
    } catch (err) {
      this.logger.warn(
        `location session take failed: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return null;
    }
  }
}
