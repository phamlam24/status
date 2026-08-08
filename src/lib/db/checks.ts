import { pool } from '../../../db/client.mjs';

export type HistoryDotStatus = 'up' | 'degraded' | 'down' | null;

export interface HistoryFailure {
  checkedAt: string;
  reason: string | null;
}

export interface HistoryBucket {
  status: HistoryDotStatus;
  failures: HistoryFailure[];
}

export interface AppStatus {
  name: string;
  lastCheckedAt: string | null;
  isUp: boolean | null;
  latencyMs: number | null;
  uptime24h: number | null;
  history: HistoryBucket[];
}

// History strip: 48 dots, one per 30-minute bucket, covering the last 24h.
// The underlying checker still runs every 5 min (status-check.timer) for a
// fresh "up now" reading; this just buckets those checks for display.
const HISTORY_BUCKETS = 48;
const HISTORY_BUCKET_SECONDS = 30 * 60;
const HISTORY_WINDOW_SECONDS = HISTORY_BUCKETS * HISTORY_BUCKET_SECONDS;

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
      `SELECT
         width_bucket(extract(epoch from (now() - checked_at)), 0, $2, $3) AS bucket_idx,
         count(*) FILTER (WHERE NOT is_up) AS fail_count,
         array_agg(checked_at ORDER BY checked_at) FILTER (WHERE NOT is_up) AS fail_times,
         array_agg(fail_reason ORDER BY checked_at) FILTER (WHERE NOT is_up) AS fail_reasons
       FROM status.checks
       WHERE app_name = $1 AND checked_at > now() - ($2 || ' seconds')::interval
       GROUP BY bucket_idx`,
      [name, HISTORY_WINDOW_SECONDS, HISTORY_BUCKETS]
    ),
  ]);

  const latest = latestRes.rows[0];
  const { up_count, total_count } = uptimeRes.rows[0];

  // bucket_idx 1 = most recent 30-min window, HISTORY_BUCKETS = oldest.
  // history[] is ordered oldest -> newest, matching the old .reverse() behavior.
  // Per bucket (checker runs every 5 min, ~6 checks/bucket): 0 failures = up,
  // 1 failure = degraded (yellow), 2+ failures = down (red).
  const history: HistoryBucket[] = Array.from({ length: HISTORY_BUCKETS }, () => ({
    status: null,
    failures: [],
  }));
  for (const row of historyRes.rows) {
    const idx = HISTORY_BUCKETS - Number(row.bucket_idx);
    if (idx < 0 || idx >= HISTORY_BUCKETS) continue;
    const failCount = Number(row.fail_count);
    const failTimes: string[] = row.fail_times ?? [];
    const failReasons: (string | null)[] = row.fail_reasons ?? [];
    history[idx] = {
      status: failCount === 0 ? 'up' : failCount === 1 ? 'degraded' : 'down',
      failures: failTimes.map((checkedAt, i) => ({ checkedAt, reason: failReasons[i] ?? null })),
    };
  }

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
