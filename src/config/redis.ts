import { Redis } from '@upstash/redis';
import { env } from './env';

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!env.redisEnabled) return null;
  if (client) return client;

  if (!env.upstashRedisRestUrl || !env.upstashRedisRestToken) return null;

  client = new Redis({
    url: env.upstashRedisRestUrl,
    token: env.upstashRedisRestToken,
  });
  return client;
}

export async function closeRedis(): Promise<void> {
  client = null;
}
