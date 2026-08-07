import { pool } from '../../../db/client.mjs';

export interface AppStatus {
  name: string;
  lastCheckedAt: string | null;
  isUp: boolean | null;
  latencyMs: number | null;
  uptime24h: number | null;
  history: boolean[];
}

const HISTORY_LIMIT = 50;

export async function getAppStatus(name: string): Promise<AppStatus> {
  const [latestRes, uptimeRes, historyRes] = await Promise.all([
    pool.query(
      `SELECT checked_at, is_up, latency_ms FROM status.checks
       WHERE app_name = $1 ORDER BY checked_at DESC LIMIT 1`,
      [name]
    ),
    pool.query(
      `SELECT count(*) FILTER (WHERE is_up) AS up_count, count(*) AS total_count
       FROM status.checks
       WHERE app_name = $1 AND checked_at > now() - interval '24 hours'`,
      [name]
    ),
    pool.query(
      `SELECT is_up FROM status.checks WHERE app_name = $1 ORDER BY checked_at DESC LIMIT $2`,
      [name, HISTORY_LIMIT]
    ),
  ]);

  const latest = latestRes.rows[0];
  const { up_count, total_count } = uptimeRes.rows[0];
  const history: boolean[] = historyRes.rows.map((r) => r.is_up).reverse();

  return {
    name,
    lastCheckedAt: latest?.checked_at ?? null,
    isUp: latest?.is_up ?? null,
    latencyMs: latest?.latency_ms ?? null,
    uptime24h: total_count > 0 ? Math.round((up_count / total_count) * 1000) / 10 : null,
    history,
  };
}

export async function getAllAppStatuses(names: string[]): Promise<AppStatus[]> {
  return Promise.all(names.map(getAppStatus));
}
