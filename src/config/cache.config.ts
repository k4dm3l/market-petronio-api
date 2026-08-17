import { registerAs } from '@nestjs/config';

export const cacheConfig = registerAs('cache', () => ({
  categoriesTtlSeconds: parseInt(
    process.env.CACHE_TTL_CATEGORIES_SECONDS ?? '3600',
    10,
  ),
  tagsTtlSeconds: parseInt(process.env.CACHE_TTL_TAGS_SECONDS ?? '600', 10),
  locationsTtlSeconds: parseInt(
    process.env.CACHE_TTL_LOCATIONS_SECONDS ?? '86400',
    10,
  ),
  locationSearchTtlSeconds: parseInt(
    process.env.CACHE_TTL_LOCATION_SEARCH_SECONDS ?? '3600',
    10,
  ),
}));
