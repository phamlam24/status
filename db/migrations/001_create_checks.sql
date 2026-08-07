CREATE SCHEMA IF NOT EXISTS status;

CREATE TABLE status.checks (
  id bigserial PRIMARY KEY,
  app_name text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  is_up boolean NOT NULL,
  latency_ms integer
);

CREATE INDEX checks_app_name_checked_at_idx ON status.checks (app_name, checked_at DESC);
