import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== '' ? v : undefined;
}

const redisEnabled = (process.env.REDIS_ENABLED || 'true').toLowerCase() === 'true';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  databaseUrl: required('DATABASE_URL'),

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || 'content',

  // Upstash Redis 
  redisEnabled,
  upstashRedisRestUrl: redisEnabled
    ? required('UPSTASH_REDIS_REST_URL')
    : optional('UPSTASH_REDIS_REST_URL'),
  upstashRedisRestToken: redisEnabled
    ? required('UPSTASH_REDIS_REST_TOKEN')
    : optional('UPSTASH_REDIS_REST_TOKEN'),
  cacheTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '30', 10),

  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/gif')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  publicRateLimitWindowMs: parseInt(process.env.PUBLIC_RATE_LIMIT_WINDOW_MS || '60000', 10),
  publicRateLimitMax: parseInt(process.env.PUBLIC_RATE_LIMIT_MAX || '60', 10),
} as const;

export type Env = typeof env;
