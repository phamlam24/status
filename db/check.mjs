import 'dotenv/config';
import { pool } from './client.mjs';

// Keep in sync with src/lib/apps.ts's MONITORED_APPS (name + url).
const APPS = [
  { name: 'home', url: 'https://lampham.space' },
  { name: 'climb', url: 'https://climbing.lampham.space' },
  { name: 'learn', url: 'https://learn.lampham.space' },
  { name: 'sprout', url: 'https://sprout.lampham.space' },
  { name: 'auth', url: 'https://auth.lampham.space' },
  { name: 'status', url: 'https://status.lampham.space' },
];

async function checkApp({ name, url }) {
  const start = Date.now();
  try {
    // redirect: 'manual' so a login-gated app's 302 to auth.lampham.space
    // is reported as that app's own status, not followed into auth's.
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'manual' });
    const latencyMs = Date.now() - start;
    // Anything under 500 (2xx, or a 302 from a login gate) means the process
    // is alive and responding correctly — that's what "up" means here, not
    // "this specific page is publicly viewable."
    return { name, isUp: res.status < 500, latencyMs };
  } catch {
    return { name, isUp: false, latencyMs: null };
  }
}

async function main() {
  const results = await Promise.all(APPS.map(checkApp));
  for (const r of results) {
    await pool.query(
      'INSERT INTO status.checks (app_name, is_up, latency_ms) VALUES ($1, $2, $3)',
      [r.name, r.isUp, r.latencyMs]
    );
    console.log(`${r.name}: ${r.isUp ? 'up' : 'down'}${r.latencyMs != null ? ` (${r.latencyMs}ms)` : ''}`);
  }
  await pool.end();
}

main();
