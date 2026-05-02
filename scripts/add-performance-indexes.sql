-- Performance indexes for NeonDB optimization
-- Run this script to add indexes that will significantly improve query performance

-- Index for case-insensitive slug lookups (most critical for redirects)
CREATE INDEX IF NOT EXISTS idx_links_slug_lower ON links(LOWER(slug));

-- Index for slug lookups (case-sensitive mode)
CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);

-- Indexes for analytics queries on access_logs
CREATE INDEX IF NOT EXISTS idx_access_logs_slug_date ON access_logs(slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_link_date ON access_logs(link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC);

-- Indexes for analytics aggregations (WHERE clauses with NOT NULL)
CREATE INDEX IF NOT EXISTS idx_access_logs_country ON access_logs(country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_logs_browser ON access_logs(browser_type) WHERE browser_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_logs_device ON access_logs(device_type) WHERE device_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_logs_os ON access_logs(os) WHERE os IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_access_logs_referer ON access_logs(referer) WHERE referer IS NOT NULL;

-- Index for QR scans analytics
CREATE INDEX IF NOT EXISTS idx_qr_scans_link_date ON qr_scans(link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qr_scans_slug ON qr_scans(slug);

-- Index for tag filtering
CREATE INDEX IF NOT EXISTS idx_links_tag_id ON links(tag_id) WHERE tag_id IS NOT NULL;

-- Index for link expiration checks
CREATE INDEX IF NOT EXISTS idx_links_expiration ON links(expiration) WHERE expiration IS NOT NULL;

-- Index for API keys lookup
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- Index for rate limiting
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key_endpoint ON api_rate_limits(api_key_id, endpoint, window_start);

-- Composite index for link listing with tag filter
CREATE INDEX IF NOT EXISTS idx_links_id_tag ON links(id DESC, tag_id);

-- Index for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);

-- Analyze tables to update statistics for query planner
ANALYZE links;
ANALYZE access_logs;
ANALYZE qr_scans;
ANALYZE tags;
ANALYZE api_keys;
ANALYZE api_rate_limits;
