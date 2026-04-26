import 'dotenv/config';
import { pool, closePool } from '../config/db';
import { supabase } from '../config/storage';
import { getRedis, closeRedis } from '../config/redis';
import { env } from '../config/env';

type Step = { name: string; ok: boolean; detail: string };
const steps: Step[] = [];

async function checkPostgres(): Promise<void> {
  try {
    const { rows } = await pool.query<{ v: number }>('SELECT 1 AS v');
    steps.push({
      name: 'Postgres',
      ok: rows[0]?.v === 1,
      detail: `connected to ${env.databaseUrl.replace(/:[^:@]+@/, ':***@')}`,
    });
  } catch (err) {
    steps.push({
      name: 'Postgres',
      ok: false,
      detail: (err as Error).message,
    });
  }
}

async function checkStorage(): Promise<void> {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    const exists = data?.some((b) => b.name === env.supabaseBucket);
    steps.push({
      name: 'Supabase Storage',
      ok: !!exists,
      detail: exists
        ? `bucket "${env.supabaseBucket}" present (${data?.length ?? 0} total)`
        : `bucket "${env.supabaseBucket}" NOT found — run npm run bootstrap`,
    });
  } catch (err) {
    steps.push({
      name: 'Supabase Storage',
      ok: false,
      detail: (err as Error).message,
    });
  }
}

async function checkRedis(): Promise<void> {
  if (!env.redisEnabled) {
    steps.push({ name: 'Upstash Redis', ok: true, detail: 'disabled (REDIS_ENABLED=false)' });
    return;
  }
  try {
    const r = getRedis();
    if (!r) throw new Error('client not initialized — check UPSTASH_REDIS_REST_URL/TOKEN');
    const key = 'cbs:verify:' + Date.now();
    await r.set(key, { ok: true }, { ex: 10 });
    const got = await r.get(key);
    await r.del(key);
    steps.push({
      name: 'Upstash Redis',
      ok: !!got,
      detail: 'set/get/del round-trip OK',
    });
  } catch (err) {
    steps.push({ name: 'Upstash Redis', ok: false, detail: (err as Error).message });
  }
}

async function main() {
  console.log('—— content-broadcasting-system :: connectivity check ——\n');
  await Promise.all([checkPostgres(), checkStorage(), checkRedis()]);
  for (const s of steps) {
    console.log(`  ${s.ok ? '✓' : '✗'}  ${s.name.padEnd(18)} ${s.detail}`);
  }
  const allOk = steps.every((s) => s.ok);
  console.log(`\n${allOk ? 'ALL OK — ready to boot.' : 'Some checks failed — fix above before continuing.'}`);
  process.exitCode = allOk ? 0 : 1;
}

main().finally(async () => {
  await Promise.allSettled([closePool(), closeRedis()]);
});
