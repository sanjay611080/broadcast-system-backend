import { getRedis } from '../config/redis';
import { env } from '../config/env';

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const value = await redis.get<T>(key);
    return value ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = env.cacheTtlSeconds,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, value as object, { ex: ttlSeconds });
  } catch {
    // best-effort
  }
}

export async function cacheDel(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    if (pattern.includes('*')) {
      let cursor: string | number = 0;
      const keys: string[] = [];
      do {
        const result = (await redis.scan(cursor, {
          match: pattern,
          count: 100,
        })) as [string | number, string[]];
        const [nextCursor, batch] = result;
        keys.push(...batch);
        cursor = nextCursor;
      } while (cursor !== '0' && cursor !== 0);
      if (keys.length) await redis.del(...keys);
    } else {
      await redis.del(pattern);
    }
  } catch {
  }
}

export const cacheKeys = {
  liveByTeacher: (teacherId: string, subject?: string) =>
    `live:teacher:${teacherId}:${subject ?? 'all'}`,
  liveByTeacherPattern: (teacherId: string) => `live:teacher:${teacherId}:*`,
  liveAllPattern: () => `live:teacher:*`,
};
