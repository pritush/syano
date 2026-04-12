-- Syano Database Schema
-- PostgreSQL 14+
-- 
-- This script creates all necessary tables for the Syano URL shortener
-- Run this script on a fresh PostgreSQL database

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Site settings table for homepage configuration
CREATE TABLE IF NOT EXISTS site_settings (
    id VARCHAR(8) PRIMARY KEY NOT NULL,
    homepage_mode VARCHAR(20),
    redirect_url VARCHAR(2048),
    bio_content JSONB
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
CREATE INDEX IF NOT EXISTS idx_links_tag_id ON links(tag_id);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_link_id ON access_logs(link_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_slug ON access_logs(slug);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_country ON access_logs(country);

-- Composite indexes for common query patterns (Performance Optimization)
CREATE INDEX IF NOT EXISTS idx_access_logs_link_created ON access_logs(link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_slug_created ON access_logs(slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_links_tag_created ON links(tag_id, created_at DESC);

-- Partial indexes for filtered queries (Performance Optimization)
CREATE INDEX IF NOT EXISTS idx_links_active ON links(created_at DESC) 
  WHERE expiration IS NULL OR expiration > EXTRACT(EPOCH FROM NOW()) * 1000;

-- Insert default site settings
INSERT INTO site_settings (id, homepage_mode, redirect_url, bio_content)
VALUES (
    'default',
    'DEFAULT',
    NULL,
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
