-- Syano CLI upgrade entry point
--
-- Run with:
--   psql "$DATABASE_URL" -f database/migrations/complete_schema_upgrade.sql
--
-- schema.sql is the canonical, idempotent schema installer. It handles a
-- fresh database, an older Syano installation, and a repeat run atomically.
-- \ir resolves relative to this file, not the caller's working directory.
\set ON_ERROR_STOP on
\ir ../schema.sql
