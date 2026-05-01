-- Complete Database Schema Upgrade
-- This file contains all migrations for the SyanoLink application
-- Safe to run multiple times (all statements use IF NOT EXISTS or IF EXISTS)
-- Date: 2026-04-30

-- ============================================================================
-- 1. QR Code Scans Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "qr_scans" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "link_id" varchar(64) REFERENCES "links"("id") ON DELETE CASCADE,
    "slug" varchar(128),
    "created_at" timestamp with time zone DEFAULT now()
);

-- ============================================================================
-- 2. Site Settings - Add redirect_timeout
-- ============================================================================
ALTER TABLE "site_settings"
ADD COLUMN IF NOT EXISTS "redirect_timeout" bigint DEFAULT 3;

-- ============================================================================
-- 3. Access Logs - Add UTM Tracking Columns
-- ============================================================================
ALTER TABLE "access_logs"
ADD COLUMN IF NOT EXISTS "utm_source" varchar(128),
ADD COLUMN IF NOT EXISTS "utm_medium" varchar(128),
ADD COLUMN IF NOT EXISTS "utm_campaign" varchar(128),
ADD COLUMN IF NOT EXISTS "utm_term" varchar(128),
ADD COLUMN IF NOT EXISTS "utm_content" varchar(128);

-- ============================================================================
-- 4. Users Table for Dashboard User Management
-- ============================================================================
CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "username" varchar(64) NOT NULL UNIQUE,
    "display_name" varchar(120),
    "password_hash" text NOT NULL,
    "permissions" text[] NOT NULL DEFAULT '{}',
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================================================
-- 5. Audit Logs Table for Compliance and Security Tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "actor_id" varchar(64) NOT NULL,
    "actor_username" varchar(128) NOT NULL,
    "action" varchar(32) NOT NULL,
    "entity_type" varchar(32) NOT NULL,
    "entity_id" varchar(128),
    "entity_label" varchar(256),
    "details" jsonb,
    "ip" inet,
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);

-- ============================================================================
-- 6. API Keys Table for REST API Authentication
-- ============================================================================
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
    "name" varchar(128) NOT NULL,
    "key_prefix" varchar(16) NOT NULL,
    "key_hash" text NOT NULL,
    "key_encrypted" text,
    "permissions" text[] NOT NULL DEFAULT '{}',
    "is_active" boolean DEFAULT true,
    "last_used_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- Add key_encrypted column for existing installations
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS key_encrypted text;

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

-- ============================================================================
-- 7. Webhooks Table for Event Notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS "webhooks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
    "name" varchar(128) NOT NULL,
    "url" text NOT NULL,
    "events" text[] NOT NULL DEFAULT '{}',
    "secret" text NOT NULL,
    "is_active" boolean DEFAULT true,
    "failure_count" bigint DEFAULT 0,
    "last_triggered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);

-- ============================================================================
-- 8. Webhook Deliveries Table for Tracking Webhook Calls
-- ============================================================================
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "webhook_id" uuid REFERENCES "webhooks"("id") ON DELETE CASCADE,
    "event_type" varchar(64) NOT NULL,
    "payload" jsonb NOT NULL,
    "response_status" bigint,
    "response_body" text,
    "error" text,
    "delivered_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at DESC);

-- ============================================================================
-- 9. API Rate Limits Table for API Throttling
-- ============================================================================
CREATE TABLE IF NOT EXISTS "api_rate_limits" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "api_key_id" uuid REFERENCES "api_keys"("id") ON DELETE CASCADE,
    "endpoint" varchar(256) NOT NULL,
    "request_count" bigint DEFAULT 0,
    "window_start" timestamp with time zone DEFAULT now(),
    "created_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_api_key_id ON api_rate_limits(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_start ON api_rate_limits(window_start);

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check if all tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'qr_scans', 'users', 'audit_logs', 'api_keys', 
            'webhooks', 'webhook_deliveries', 'api_rate_limits'
        ) THEN '✓ Exists'
        ELSE '✗ Missing'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
      'qr_scans', 'users', 'audit_logs', 'api_keys', 
      'webhooks', 'webhook_deliveries', 'api_rate_limits'
  )
ORDER BY table_name;

-- Check if key_encrypted column exists in api_keys
SELECT 
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name = 'key_encrypted' THEN '✓ API Key Reveal Feature Enabled'
        ELSE ''
    END as feature_status
FROM information_schema.columns 
WHERE table_name = 'api_keys' 
  AND column_name = 'key_encrypted';

-- Check API keys encryption status
SELECT 
    COUNT(*) as total_api_keys,
    COUNT(key_encrypted) as keys_with_encryption,
    COUNT(*) - COUNT(key_encrypted) as keys_without_encryption,
    CASE 
        WHEN COUNT(key_encrypted) > 0 THEN '✓ Encryption Active'
        WHEN COUNT(*) = 0 THEN 'ℹ No API Keys Yet'
        ELSE '⚠ Encryption Not Active (Create New Keys)'
    END as encryption_status
FROM api_keys;

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- All schema changes have been applied successfully!
-- 
-- Next Steps:
-- 1. Set ENCRYPTION_KEY in your .env file
-- 2. Restart your application server
-- 3. Create new API keys to test the reveal feature
-- 4. Old API keys will continue to work but cannot be revealed
-- ============================================================================
