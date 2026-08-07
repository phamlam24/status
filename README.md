# status

Public uptime status page for `*.lampham.space`. See `CLAUDE.md` for details and `../docs/HOSTING.md` (root repo) for server/infra deployment.

```
npm run dev          # http://localhost:4326
npm run build
npm run preview
npm run migrate      # applies db/migrations/*.sql
npm run check-now    # runs one round of checks against every monitored app, inserts rows
```
