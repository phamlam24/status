import { pool } from '../../../db/client.mjs';

export interface AppMeta {
  version: string | null;
  lastCommitSha: string | null;
  lastCommitAt: string | null;
}

export async function getAllAppMeta(): Promise<Map<string, AppMeta>> {
  const { rows } = await pool.query(
    'SELECT app_name, version, last_commit_sha, last_commit_at FROM status.app_meta'
  );
  return new Map(
    rows.map((r) => [
      r.app_name,
      { version: r.version, lastCommitSha: r.last_commit_sha, lastCommitAt: r.last_commit_at },
    ])
  );
}
