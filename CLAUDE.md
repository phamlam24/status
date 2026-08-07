# status — Claude Code context

See [`../CLAUDE.md`](../CLAUDE.md) for cross-app architecture (including the versioning policy) and [`../docs/HOSTING.md`](../docs/HOSTING.md) for server/infra details. This file only covers things specific to this app's code.

Worktrees are allowed (see `../CLAUDE.md`'s Git workflow section) — edit directly in this checkout for most changes, use one when isolation actually helps.

## What this is

Public uptime status page for every app in the `*.lampham.space` suite, plus their version and last-commit info. Built with **Astro (SSR, server output)** + Tailwind CSS v4 + Catppuccin Macchiato, matching the other apps' look. No Preact islands (no interactivity needed), but it **does** carry the shared auth pattern now — see "Login-gated visibility" below.

## How checks work

This app has **three separate runtime pieces**, not just the web server:

1. **The web app** (`status.service`) — serves `src/pages/index.astro`, which reads the latest rows out of `status.checks`/`status.app_meta` per app and renders them. It never makes outbound requests itself.
2. **The uptime checker** (`db/check.mjs`, run by `status-check.timer` every 5 minutes) — a plain Node script (not part of the Astro build) that `fetch()`es each monitored app's public URL with a 5s timeout and `redirect: 'manual'`, and inserts one row per app into `status.checks`. `redirect: 'manual'` matters: a login-gated app (`learn`, `sprout`) returns a 302 to `auth.lampham.space` on an anonymous GET, and following that redirect would end up checking `auth`'s status instead of the app's own. Any response under 500 (including that 302) counts as "up" — the check is "is this app's process alive and responding correctly," not "is this specific page public."
3. **The version/commit checker** (`db/check-meta.mjs`, run by `status-meta.timer` hourly — much less frequent than uptime since this changes rarely) — for each app, hits the GitHub API for its latest commit on `main` and fetches `package.json` off `raw.githubusercontent.com` for its `version`, upserting into `status.app_meta`. **Requires `GITHUB_TOKEN`** (a fine-grained PAT with read-only Contents access) for `learn`/`sprout`/`server-auth` specifically — those three repos are private, so unauthenticated GitHub API calls 404 on them (this bit us once while building it: looked like a rate limit, was actually just no auth). `climbing-tracker`/`home`/`status` are public and work without a token, but the token is applied to every request uniformly since it's harmless for public repos too.

The monitored-apps list is duplicated in **three** places and must be kept in sync manually: `db/check.mjs`'s `APPS` array, `db/check-meta.mjs`'s `APPS` array (both plain `.mjs`, run standalone), and `src/lib/apps.ts`'s `MONITORED_APPS` (used by the page). Not shared because the two checker scripts aren't part of the Astro/Vite build.

## Login-gated visibility

Unlike the uptime/version data (always collected), **not every monitored entry is shown to an anonymous visitor**. Each entry in `MONITORED_APPS` has a `public: boolean`. `home`/`climb`/`status` are public; `learn`/`sprout`/`auth` are not — they're hidden from the page entirely unless the viewer is logged in *and* `auth` itself is currently reporting up (checked against the just-fetched `status.checks` data for `app_name = 'auth'`). That second condition is deliberate: don't show internal infra to an anonymous visitor based on a session that might not even be verifiable right now.

This reuses the exact same local-JWT-verification pattern as every other app (`src/lib/verifyAccessToken.ts`, `src/lib/authOrigin.ts`, `src/lib/auth.ts`'s `isLoggedIn()`, `src/middleware.ts` for silent token refresh) — copied from `home`'s implementation since the "gate visibility, not the whole page" shape matches. This is the one thing that changed status from "no auth code at all" to "same auth wiring as everything else" — needs `JWT_SECRET` now, must match the other apps'.

## Data model (schema `status`)

- `status.checks` — one row per app per uptime check: `id, app_name, checked_at, is_up, latency_ms`. No retention/pruning job yet — small for a long time at this volume; revisit if it ever matters.
- `status.app_meta` — one row per app (upserted, not appended): `app_name (PK), version, last_commit_sha, last_commit_at, checked_at`. A failed fetch for one field (e.g. GitHub API down) doesn't clobber the other with `null` — the upsert uses `COALESCE(EXCLUDED.x, status.app_meta.x)` to keep the last-known-good value.

## Project structure

```
db/
  client.mjs / migrate.mjs / migrations/     # same tiny hand-rolled runner as every app,
                                               # migration ids prefixed "status/"
  check.mjs                                    # uptime checker, every 5 min — see "How checks work"
  check-meta.mjs                                # version/commit checker, hourly — needs GITHUB_TOKEN

src/
  lib/
    apps.ts                    # MONITORED_APPS — name/url/kind('app'|'service')/public/repo
    auth.ts / authOrigin.ts / verifyAccessToken.ts   # same shared pattern as home/climbing-tracker
    db/
      checks.ts                  # getAppStatus()/getAllAppStatuses() — latest status,
                                   # 24h uptime %, and a short history strip per app
      meta.ts                     # getAllAppMeta() — version + last commit per app

  middleware.ts                # silent access-token refresh (same pattern as home/learn/climbing-tracker)

  layouts/
    BaseLayout.astro            # minimal shell, no header nav

  components/
    Footer.astro                 # shared footer pattern (home/apps nav, github, copyright) —
                                   # no "status" link (this *is* the status page) and no
                                   # loggedIn prop passed (public footer regardless of page auth state)
    AppCard.astro                 # one monitored entry's card — dot, name, version, uptime,
                                   # history strip, last-commit line. Shared by both page sections
                                   # so the Apps/Services split doesn't duplicate the template.

  pages/
    index.astro                  # Apps section + Services section, filtered by public/loggedIn/authUp,
                                   # login/logout link in the header (same pattern as home/apps.astro)
```

## Adding a monitored app

1. Add `{ name, url }` to `db/check.mjs`'s `APPS` array.
2. Add `{ name, repo }` to `db/check-meta.mjs`'s `APPS` array.
3. Add `{ name, url, kind, public, repo }` to `src/lib/apps.ts`'s `MONITORED_APPS` — `name` must match exactly across all three, it's the foreign key into `status.checks.app_name`/`status.app_meta.app_name`. `name` is the one-word lowercase display name too (e.g. `climb`, not `climbing-tracker` or `Climbing Tracker`) — `repo` is the only place the actual GitHub repo slug lives.

No schema/migration change needed — `app_name` is a plain `text` column, not an enum/FK.
