import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  MONGODB_URI: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  CLOUDINARY_CLOUD_NAME: Joi.string().optional(),
  CLOUDINARY_API_KEY: Joi.string().optional(),
  CLOUDINARY_API_SECRET: Joi.string().optional(),
  RESEND_API_KEY: Joi.string().optional(),
  EMAIL_FROM: Joi.string().optional(),
  PLATFORM_URL: Joi.string().uri().default('http://localhost:5173'),
  REDIS_URL: Joi.string().default('redis://127.0.0.1:6379'),
  CACHE_TTL_CATEGORIES_SECONDS: Joi.number().integer().min(1).default(3600),
  CACHE_TTL_TAGS_SECONDS: Joi.number().integer().min(1).default(600),
  CACHE_TTL_LOCATIONS_SECONDS: Joi.number().integer().min(1).default(86400),
  CACHE_TTL_LOCATION_SEARCH_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(3600),
  GOOGLE_MAPS_API_KEY: Joi.string().optional(),
  GOOGLE_MAPS_TIMEOUT_MS: Joi.number().integer().min(1000).max(15000).default(4000),
});
