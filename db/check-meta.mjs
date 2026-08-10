import 'dotenv/config';
import { pool } from './client.mjs';
import { emitEvent } from './events.mjs';

// Keep in sync with src/lib/apps.ts's MONITORED_APPS (name + repo).
const APPS = [
  { name: 'home', repo: 'home' },
  { name: 'climb', repo: 'climbing-tracker' },
  { name: 'learn', repo: 'learn' },
  { name: 'sprout', repo: 'sprout' },
  { name: 'auth', repo: 'server-auth' },
  { name: 'status', repo: 'status' },
];

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const ghHeaders = {
  Accept: 'application/vnd.github+json',
  ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
};

async function fetchMeta({ name, repo }) {
  try {
    const [commitRes, pkgRes] = await Promise.all([
      fetch(`https://api.github.com/repos/phamlam24/${repo}/commits/main`, {
        headers: ghHeaders,
        signal: AbortSignal.timeout(10000),
      }),
      fetch(`https://raw.githubusercontent.com/phamlam24/${repo}/main/package.json`, {
        headers: GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {},
        signal: AbortSignal.timeout(10000),
      }),
    ]);

    let lastCommitSha = null;
    let lastCommitAt = null;
    if (commitRes.ok) {
      const commit = await commitRes.json();
      lastCommitSha = commit.sha?.slice(0, 7) ?? null;
      lastCommitAt = commit.commit?.committer?.date ?? commit.commit?.author?.date ?? null;
    }

    let version = null;
    if (pkgRes.ok) {
      const pkg = await pkgRes.json();
      version = pkg.version ?? null;
    }

    return { name, version, lastCommitSha, lastCommitAt };
  } catch {
    return { name, version: null, lastCommitSha: null, lastCommitAt: null };
  }
}

async function main() {
  const results = await Promise.all(APPS.map(fetchMeta));
  for (const r of results) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: prevRows } = await client.query(
        `SELECT version, last_commit_sha FROM status.app_meta WHERE app_name = $1`,
        [r.name]
      );
      const prev = prevRows[0];

      await client.query(
        `INSERT INTO status.app_meta (app_name, version, last_commit_sha, last_commit_at, checked_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (app_name) DO UPDATE SET
           version = COALESCE(EXCLUDED.version, status.app_meta.version),
           last_commit_sha = COALESCE(EXCLUDED.last_commit_sha, status.app_meta.last_commit_sha),
           last_commit_at = COALESCE(EXCLUDED.last_commit_at, status.app_meta.last_commit_at),
           checked_at = now()`,
        [r.name, r.version, r.lastCommitSha, r.lastCommitAt]
      );

      // Only emit once we have a prior row to compare against — the very
      // first check for an app has nothing to diff, so it shouldn't fire.
      const changed =
        prev &&
        ((r.lastCommitSha && r.lastCommitSha !== prev.last_commit_sha) ||
          (r.version && r.version !== prev.version));
      if (changed) {
        await emitEvent(client, 'status.app_updated', {
          app: r.name,
          version: r.version,
          previousVersion: prev.version,
          commitSha: r.lastCommitSha,
          previousCommitSha: prev.last_commit_sha,
        });
      }

      await client.query('COMMIT');
      console.log(
        `${r.name}: v${r.version ?? '?'} @ ${r.lastCommitSha ?? '?'} (${r.lastCommitAt ?? 'unknown'})${changed ? ' [changed, event emitted]' : ''}`
      );
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  await pool.end();
}

main();
