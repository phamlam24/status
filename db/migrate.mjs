import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './client.mjs';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const id = `status/${file}`;
    const { rowCount } = await pool.query('SELECT 1 FROM public.schema_migrations WHERE id = $1', [id]);
    if (rowCount > 0) continue;

    const sql = await readFile(join(migrationsDir, file), 'utf-8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations (id) VALUES ($1)', [id]);
      await client.query('COMMIT');
      console.log(`Applied ${id}`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`Failed applying ${id}:`, e);
      process.exitCode = 1;
      break;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

main();
