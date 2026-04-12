CREATE INDEX IF NOT EXISTS idx_access_logs_link_id_created_at
  ON access_logs (link_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_links_created_at_id
  ON links (created_at DESC, id);

