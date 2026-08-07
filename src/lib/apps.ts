export interface MonitoredApp {
  /** One-word lowercase key — also the foreign key into status.checks/app_meta. */
  name: string;
  url: string;
  /** "app" = something the owner actually built and uses; "service" = infra the apps depend on. */
  kind: 'app' | 'service';
  /** Visible to anyone. false = only shown to a logged-in viewer (and only if auth is up). */
  public: boolean;
  /** GitHub repo slug under github.com/phamlam24, for db/check-meta.mjs. */
  repo: string;
}

// Keep in sync with db/check.mjs's APPS list and db/check-meta.mjs's — both
// are plain .mjs scripts run standalone by systemd timers, not part of the
// Astro/Vite build, so this list can't be shared with them directly.
export const MONITORED_APPS: MonitoredApp[] = [
  { name: 'home', url: 'https://lampham.space', kind: 'app', public: true, repo: 'home' },
  { name: 'climb', url: 'https://climbing.lampham.space', kind: 'app', public: true, repo: 'climbing-tracker' },
  { name: 'learn', url: 'https://learn.lampham.space', kind: 'app', public: false, repo: 'learn' },
  { name: 'sprout', url: 'https://sprout.lampham.space', kind: 'app', public: false, repo: 'sprout' },
  { name: 'auth', url: 'https://auth.lampham.space', kind: 'service', public: false, repo: 'server-auth' },
  { name: 'status', url: 'https://status.lampham.space', kind: 'service', public: true, repo: 'status' },
];
