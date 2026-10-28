-- Running totals the public site can show (the per-event detail lives in Analytics Engine; see worker/src/events.ts).
CREATE TABLE counters (
  name TEXT PRIMARY KEY,
  n    INTEGER NOT NULL DEFAULT 0
);
INSERT INTO counters (name, n) VALUES ('views', 0);
