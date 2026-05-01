-- Syano Database Schema
-- PostgreSQL 14+
-- 
-- This script creates all necessary tables for the Syano URL shortener
-- Run this script on a fresh PostgreSQL database

-- Tags table for organizing links
CREATE TABLE IF NOT EXISTS tags (
    id VARCHAR(64) PRIMARY KEY NOT NULL,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Links table for shortened URLs
CREATE TABLE IF NOT EXISTS links (
    id VARCHAR(64) PRIMARY KEY NOT NULL,
    slug VARCHAR(128) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiration BIGINT,
    title TEXT,
    description TEXT,
    image TEXT,
    apple TEXT,
    google TEXT,
    cloaking BOOLEAN DEFAULT FALSE,
    redirect_with_query BOOLEAN DEFAULT FALSE,
    password TEXT,
    unsafe BOOLEAN DEFAULT FALSE,
    tag_id VARCHAR(64) REFERENCES tags(id) ON DELETE SET NULL
);

-- Access logs table for analytics
CREATE TABLE IF NOT EXISTS access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id VARCHAR(64) REFERENCES links(id) ON DELETE SET NULL,
    slug VARCHAR(128),
    url TEXT,
    ua TEXT,
    ip INET,
    referer TEXT,
    country VARCHAR(120),
    region TEXT,
    city TEXT,
    timezone TEXT,
    language TEXT,
    os TEXT,
    browser TEXT,
    browser_type TEXT,
    device TEXT,
    device_type TEXT,
    latitude DOUBLE PRECISION DEFAULT 0,
    longitude DOUBLE PRECISION DEFAULT 0,
    utm_source VARCHAR(128),
    utm_medium VARCHAR(128),
    utm_campaign VARCHAR(128),
    utm_term VARCHAR(128),
    utm_content VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- QR scans tracking table
CREATE TABLE IF NOT EXISTS qr_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id VARCHAR(64) REFERENCES links(id) ON DELETE CASCADE,
    slug VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Site settings table for homepage configuration
CREATE TABLE IF NOT EXISTS site_settings (
    id VARCHAR(8) PRIMARY KEY NOT NULL,
    homepage_mode VARCHAR(20),
    redirect_url VARCHAR(2048),
    redirect_timeout BIGINT DEFAULT 3,
    bio_content JSONB
);

-- Users table for dashboard user management
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) NOT NULL UNIQUE,
    display_name VARCHAR(120),
    password_hash TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit logs table for immutable action tracking
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id VARCHAR(64) NOT NULL,
    actor_username VARCHAR(128) NOT NULL,
    action VARCHAR(32) NOT NULL,
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(128),
    entity_label VARCHAR(256),
    details JSONB,
    ip INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API keys table for API authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash TEXT NOT NULL,
    key_encrypted TEXT,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhooks table for event notifications
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    failure_count BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook deliveries table for tracking webhook calls
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    response_status BIGINT,
    response_body TEXT,
    error TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API rate limiting table
CREATE TABLE IF NOT EXISTS api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint VARCHAR(256) NOT NULL,
    request_count BIGINT DEFAULT 0,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
CREATE INDEX IF NOT EXISTS idx_links_tag_id ON links(tag_id);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_link_id ON access_logs(link_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_slug ON access_logs(slug);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_country ON access_logs(country);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_api_key_id ON api_rate_limits(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON api_rate_limits(window_start);

-- Composite indexes for common query patterns (Performance Optimization)
CREATE INDEX IF NOT EXISTS idx_access_logs_link_created ON access_logs(link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_slug_created ON access_logs(slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_links_tag_created ON links(tag_id, created_at DESC);

-- Partial indexes for filtered queries (Performance Optimization)
CREATE INDEX IF NOT EXISTS idx_links_active ON links(created_at DESC) 
  WHERE expiration IS NULL OR expiration > EXTRACT(EPOCH FROM NOW()) * 1000;

-- Insert default site settings
INSERT INTO site_settings (id, homepage_mode, redirect_url, redirect_timeout, bio_content)
VALUES (
    'default',
    'DEFAULT',
    NULL,
    3,
    '{"profile": {"name": "Syano", "bio": null, "initials": "SY", "avatar_url": null}, "links": [], "socials": []}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_links_updated_at
    BEFORE UPDATE ON links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Syano database schema created successfully!';
    RAISE NOTICE 'You can now start the application.';
END $$;
