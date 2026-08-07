CREATE TABLE status.app_meta (
  app_name text PRIMARY KEY,
  version text,
  last_commit_sha text,
  last_commit_at timestamptz,
  checked_at timestamptz NOT NULL DEFAULT now()
);
