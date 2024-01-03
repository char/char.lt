 CREATE TABLE redirects (
  path TEXT NOT NULL,
  target_location TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE UNIQUE INDEX redirects_idx ON redirects(path);
