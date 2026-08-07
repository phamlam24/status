export interface MonitoredApp {
  name: string;
  label: string;
  url: string;
}

// Keep in sync with db/check.mjs's APPS list — duplicated rather than shared
// since check.mjs is a plain .mjs script run standalone by the systemd timer.
export const MONITORED_APPS: MonitoredApp[] = [
  { name: 'home', label: 'home', url: 'https://lampham.space' },
  { name: 'climbing', label: 'Climbing Tracker', url: 'https://climbing.lampham.space' },
  { name: 'auth', label: 'Auth', url: 'https://auth.lampham.space' },
  { name: 'learn', label: 'Learn', url: 'https://learn.lampham.space' },
  { name: 'sprout', label: 'Sprout', url: 'https://sprout.lampham.space' },
  { name: 'status', label: 'Status (this page)', url: 'https://status.lampham.space' },
];
