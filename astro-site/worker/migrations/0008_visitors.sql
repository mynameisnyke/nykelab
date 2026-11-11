-- Unique visitors, without cookies and without keeping anything that identifies a person (see worker/src/events.ts).
-- A visitor is a hash of that day's random salt + IP address + browser. The salt and the hashes are thrown away when the day (UTC)
-- ends, so the same person on another day cannot be linked; what stays is the running totals in `counters`
-- ('visitors' for the site, 'visitors:/journal/<slug>' per post): each one is the sum of every day's unique visitors.
CREATE TABLE visit_days (
  day  TEXT PRIMARY KEY, -- "2026-11-11" (UTC)
  salt TEXT NOT NULL
);
CREATE TABLE visits (
  day     TEXT NOT NULL,
  path    TEXT NOT NULL, -- "*" for the whole site, or a post's path
  visitor TEXT NOT NULL,
  PRIMARY KEY (day, path, visitor)
) WITHOUT ROWID;
