CREATE TABLE collections (
  slug       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE media (
  id           TEXT PRIMARY KEY,
  collection   TEXT NOT NULL REFERENCES collections(slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  type         TEXT NOT NULL CHECK (type IN ('image', 'video')),
  caption      TEXT NOT NULL DEFAULT '',
  place        TEXT NOT NULL DEFAULT '',
  orientation  TEXT NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait', 'unknown')),
  width        INTEGER NOT NULL DEFAULT 0,
  height       INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0,
  published    INTEGER NOT NULL DEFAULT 1,
  featured     INTEGER NOT NULL DEFAULT 0,
  key_main     TEXT NOT NULL,
  key_small    TEXT,
  key_poster   TEXT,
  size_bytes   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_media_collection ON media (collection, position);
CREATE INDEX idx_media_featured ON media (featured, published);
