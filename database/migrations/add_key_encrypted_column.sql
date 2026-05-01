-- Migration: Add key_encrypted column to api_keys table
-- Purpose: Enable API key reveal feature by storing encrypted keys
-- Date: 2026-04-30
-- Safe to run multiple times (idempotent)

-- Add the key_encrypted column if it doesn't exist
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS key_encrypted text;

-- Verify the column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'api_keys' 
  AND column_name = 'key_encrypted';

-- Check statistics
SELECT 
    COUNT(*) as total_keys,
    COUNT(key_encrypted) as keys_with_encryption,
    COUNT(*) - COUNT(key_encrypted) as keys_without_encryption
FROM api_keys;

-- Expected output:
-- column_name     | data_type | is_nullable | column_default
-- key_encrypted   | text      | YES         | NULL
--
-- This column stores the encrypted full API key for retrieval
-- NULL values indicate keys created before encryption was enabled
