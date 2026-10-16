-- URL Detection — stores URLs detected by the browser extension from pages
-- users visit. The extension calls POST /api/url-detection with the page URL,
-- title, and metadata. This lets admins see what content users are reading
-- and potentially turn it into evidence. One row per unique URL per user
-- (upserted on re-visit), with visit count and last visited timestamp.

CREATE TABLE detected_urls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  title TEXT,
  favicon TEXT,
  visit_count INTEGER NOT NULL DEFAULT 1,
  last_visited_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_detected_urls_user_id ON detected_urls(user_id);
CREATE INDEX idx_detected_urls_normalized_url ON detected_urls(normalized_url);
CREATE UNIQUE INDEX idx_detected_urls_user_url ON detected_urls(user_id, normalized_url);
CREATE INDEX idx_detected_urls_last_visited ON detected_urls(last_visited_at);