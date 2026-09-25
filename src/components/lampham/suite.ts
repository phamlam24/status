/*
  The suite's app list, as shown in the suite bar's switcher and the footer.
  `id` doubles as the `data-app` key in tokens.css (accent colour).
  Private apps redirect anonymous visitors to login, so they're only listed
  to a logged-in viewer.
*/
export type SuiteAppId = 'home' | 'climb' | 'sprout' | 'learn' | 'status' | 'auth';

export interface SuiteApp {
  id: SuiteAppId;
  label: string;
  blurb: string;
  url: string;
  public: boolean;
}

export const HOME_URL = 'https://lampham.space';
export const APPS_HUB_URL = 'https://lampham.space/apps';
export const GITHUB_URL = 'https://github.com/phamlam24';

export const SUITE_APPS: SuiteApp[] = [
  { id: 'climb',  label: 'climb',  blurb: 'climbing log',  url: 'https://climbing.lampham.space', public: true },
  { id: 'sprout', label: 'sprout', blurb: 'weekly quests', url: 'https://sprout.lampham.space',   public: false },
  { id: 'learn',  label: 'learn',  blurb: 'courses',       url: 'https://learn.lampham.space',    public: false },
  { id: 'status', label: 'status', blurb: 'uptime',        url: 'https://status.lampham.space',   public: true },
];
