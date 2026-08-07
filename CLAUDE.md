# status — Claude Code context

See [`../CLAUDE.md`](../CLAUDE.md) for cross-app architecture and [`../docs/HOSTING.md`](../docs/HOSTING.md) for server/infra details. This file only covers things specific to this app's code.

**No worktrees, ever** — edit directly in this checkout (see `../CLAUDE.md`'s Git workflow section).

## What this is

Public uptime status page for every app in the `*.lampham.space` suite. No auth, no admin editing — it's a public dashboard. Built with **Astro (SSR, server output)** + Tailwind CSS v4 + Catppuccin Macchiato, matching the other apps' look, but with no Preact islands (no interactivity needed) and no auth code at all (the one app in this family that doesn't touch `JWT_SECRET`/`AUTH_ORIGIN`).

## How checks work

Unlike every other app here, this one has **two separate runtime pieces**, not just the web server:

1. **The web app** (`status.service`) — serves `src/pages/index.astro`, which reads the latest rows out of `status.checks` per app and renders them. It never makes outbound requests itself.
2. **The checker** (`db/check.mjs`, run by `status-check.timer` every 5 minutes) — a plain Node script (not part of the Astro build) that `fetch()`es each monitored app's public URL with a 5s timeout and `redirect: 'manual'`, and inserts one row per app into `status.checks`. `redirect: 'manual'` matters: a login-gated app (`learn`, `sprout`) returns a 302 to `auth.lampham.space` on an anonymous GET, and following that redirect would end up checking `auth`'s status instead of the app's own. Any response under 500 (including that 302) counts as "up" — the check is "is this app's process alive and responding correctly," not "is this specific page public."

The monitored-apps list is duplicated in two places and must be kept in sync manually: `db/check.mjs`'s `APPS` array (plain `.mjs`, runs standalone) and `src/lib/apps.ts`'s `MONITORED_APPS` (used by the page for labels/links). They're not shared because `check.mjs` isn't part of the Astro/Vite build.

## Data model (schema `status`)

`status.checks` — one row per app per check: `id, app_name, checked_at, is_up, latency_ms`. No retention/pruning job yet — at one row per app every 5 minutes across 6 apps, this is small for a long time; revisit if it ever matters.

## Project structure

```
db/
  client.mjs / migrate.mjs / migrations/     # same tiny hand-rolled runner as every app,
                                               # migration ids prefixed "status/"
  check.mjs                                    # the checker script, see "How checks work" above

src/
  lib/
    apps.ts                    # MONITORED_APPS — name/label/url per app (page-facing)
    db/checks.ts                 # getAppStatus()/getAllAppStatuses() — latest status,
                                   # 24h uptime %, and a short history strip per app

  layouts/
    BaseLayout.astro            # minimal shell, no header nav

  components/
    Footer.astro                 # shared footer pattern (home/apps nav, github, copyright) —
                                   # no "status" link (this *is* the status page) and no
                                   # loggedIn prop (no auth concept in this app)

  pages/
    index.astro                  # the whole page: one card per monitored app
```

## Adding a monitored app

1. Add `{ name, url }` to `db/check.mjs`'s `APPS` array.
2. Add `{ name, label, url }` to `src/lib/apps.ts`'s `MONITORED_APPS` — `name` must match exactly, it's the foreign key into `status.checks.app_name`.

No schema/migration change needed — `app_name` is a plain `text` column, not an enum/FK.
