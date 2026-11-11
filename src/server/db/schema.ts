export const migrations = [String.raw`
PRAGMA foreign_keys = ON;

CREATE TABLE conversations (
  id          TEXT PRIMARY KEY,                -- uuid v4
  title       TEXT NOT NULL,
  origin      TEXT NOT NULL DEFAULT 'live' CHECK (origin IN ('live','fixture')),
  created_at  TEXT NOT NULL,                   -- ISO 8601 UTC
  updated_at  TEXT NOT NULL
);

CREATE TABLE messages (
  rowid_alias INTEGER PRIMARY KEY,             -- explicit rowid for FTS content table
  id          TEXT NOT NULL UNIQUE,            -- uuid v4
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete','interrupted','failed')),
  created_at  TEXT NOT NULL,                   -- ISO UTC (authoritative instant)
  local_date  TEXT NOT NULL,                   -- 'YYYY-MM-DD' in tz at write time
  tz          TEXT NOT NULL,                   -- IANA, e.g. 'Asia/Kolkata'
  reply_to    TEXT REFERENCES messages(id) ON DELETE CASCADE,  -- assistant -> user message
  client_message_id TEXT UNIQUE,               -- user submission or retry-attempt identity
  meta        TEXT,                            -- JSON: model, usage, timings, assumptions
  UNIQUE (conversation_id, seq)
);
CREATE INDEX idx_messages_local_date ON messages(local_date);
CREATE INDEX idx_messages_conv_seq   ON messages(conversation_id, seq);

CREATE VIRTUAL TABLE messages_fts USING fts5(
  content, content='messages', content_rowid='rowid_alias', tokenize='porter unicode61'
);
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid_alias, new.content);
END;
CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid_alias, old.content);
END;
CREATE TRIGGER messages_au AFTER UPDATE OF content ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.rowid_alias, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid_alias, new.content);
END;

CREATE TABLE searches (
  id          TEXT PRIMARY KEY,
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,  -- assistant message
  round       INTEGER NOT NULL,
  query       TEXT NOT NULL,
  freshness   TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  duration_ms INTEGER,
  status      TEXT NOT NULL CHECK (status IN ('ok','empty','error','timeout','skipped_budget')),
  error       TEXT
);
CREATE INDEX idx_searches_message ON searches(message_id);

CREATE TABLE sources (
  id           TEXT PRIMARY KEY,
  search_id    TEXT NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  rank         INTEGER NOT NULL,
  url          TEXT NOT NULL,
  title        TEXT,
  excerpt      TEXT NOT NULL,                  -- exactly what the model saw (sanitized)
  published_at TEXT,                           -- provider estimate; may be NULL
  retrieved_at TEXT NOT NULL,                  -- ISO UTC
  fixture      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_sources_search ON sources(search_id);

CREATE TABLE citations (
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  marker      INTEGER NOT NULL,                -- n in [n]
  source_id   TEXT REFERENCES sources(id) ON DELETE SET NULL,  -- NULL = unknown source / deleted
  state       TEXT NOT NULL CHECK (state IN ('verified','unverified','unchecked','invalid')),
  detail      TEXT,                            -- e.g. 'missing: $90, 12 Nov'
  PRIMARY KEY (message_id, marker)
);
`];
