import fs from 'node:fs';
import path from 'node:path';
import { supabase } from '../config/storage';
import { env } from '../config/env';
import { pool, closePool } from '../config/db';
import { hashPassword } from '../utils/password';

async function ensureBucket() {
  console.log(`[bootstrap] ensuring storage bucket "${env.supabaseBucket}"...`);
  const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) throw new Error(`listBuckets failed: ${listErr.message}`);

  const exists = buckets?.some((b) => b.name === env.supabaseBucket);
  if (exists) {
    console.log('[bootstrap]   bucket already exists.');
    const { error: updateErr } = await supabase.storage.updateBucket(env.supabaseBucket, {
      public: true,
    });
    if (updateErr) console.warn('[bootstrap]   updateBucket warn:', updateErr.message);
    return;
  }

  const { error: createErr } = await supabase.storage.createBucket(env.supabaseBucket, {
    public: true,
  });
  if (createErr) throw new Error(`createBucket failed: ${createErr.message}`);
  console.log('[bootstrap]   bucket created (public).');
}

async function applySchema() {
  console.log('[bootstrap] applying schema.sql...');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('[bootstrap]   schema applied.');
}

async function seed() {
  console.log('[bootstrap] seeding default users + slots...');
  const principal = {
    name: 'Default Principal',
    email: 'principal@example.com',
    password: 'Principal@123',
  };
  const teachers = [
    { name: 'Maths Teacher', email: 'maths@example.com', password: 'Teacher@123' },
    { name: 'Science Teacher', email: 'science@example.com', password: 'Teacher@123' },
  ];

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'principal')
     ON CONFLICT (email) DO NOTHING`,
    [principal.name, principal.email, await hashPassword(principal.password)],
  );

  for (const t of teachers) {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'teacher')
       ON CONFLICT (email) DO NOTHING`,
      [t.name, t.email, await hashPassword(t.password)],
    );
  }

  for (const subject of ['maths', 'science', 'english']) {
    await pool.query(
      `INSERT INTO content_slots (subject) VALUES ($1)
       ON CONFLICT (subject) DO NOTHING`,
      [subject],
    );
  }

  console.log('[bootstrap]   default credentials:');
  console.log(`     principal -> ${principal.email} / ${principal.password}`);
  for (const t of teachers) console.log(`     teacher   -> ${t.email} / ${t.password}`);
}

async function main() {
  await ensureBucket();
  await applySchema();
  await seed();
  console.log('[bootstrap] done.');
}

main()
  .catch((err) => {
    console.error('[bootstrap] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
