# Database Migrations

This directory contains SQL migration files for the SyanoLink application.

## Quick Start

### Option 1: Use the Dashboard (Recommended)

1. Go to **Dashboard → Data Ops**
2. Click **"Run Database Upgrade"**
3. Wait for the success message
4. Done! ✅

### Option 2: Run SQL Directly

Connect to your PostgreSQL database and run:

```bash
psql -U your_username -d your_database -f database/migrations/complete_schema_upgrade.sql
```

Or using the connection string:

```bash
psql "postgresql://user:password@localhost:5432/dbname" -f database/migrations/complete_schema_upgrade.sql
```

### Option 3: Individual Migration

To add only the `key_encrypted` column:

```bash
psql "your_connection_string" -f database/migrations/add_key_encrypted_column.sql
```

## Migration Files

### `complete_schema_upgrade.sql`
Complete schema with all tables and columns. Includes:
- QR code scans tracking
- UTM parameter tracking
- User management
- Audit logging
- API keys with encryption support
- Webhooks
- Rate limiting

**Safe to run multiple times** - uses `IF NOT EXISTS` and `IF EXISTS` clauses.

### `add_key_encrypted_column.sql`
Adds only the `key_encrypted` column to the `api_keys` table.

**Use this if:**
- You already have the api_keys table
- You only need to add the encryption feature
- You want a minimal migration

## What Gets Added

### For API Key Reveal Feature

The key change for the API key reveal feature:

```sql
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS key_encrypted text;
```

This column stores the encrypted full API key, allowing it to be revealed later.

## Verification

After running the migration, verify it worked:

### Check Column Exists

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'api_keys' 
  AND column_name = 'key_encrypted';
```

Expected output:
```
 column_name   | data_type | is_nullable 
---------------+-----------+-------------
 key_encrypted | text      | YES
```

### Check API Keys Status

```sql
SELECT 
    COUNT(*) as total_keys,
    COUNT(key_encrypted) as encrypted_keys,
    COUNT(*) - COUNT(key_encrypted) as unencrypted_keys
FROM api_keys;
```

Example output:
```
 total_keys | encrypted_keys | unencrypted_keys 
------------+----------------+------------------
          5 |              2 |                3
```

This shows:
- 5 total API keys
- 2 can be revealed (have encrypted data)
- 3 cannot be revealed (created before encryption)

## Troubleshooting

### Error: "relation api_keys does not exist"

The api_keys table hasn't been created yet. Run the complete schema upgrade:

```bash
psql "your_connection_string" -f database/migrations/complete_schema_upgrade.sql
```

### Error: "column key_encrypted already exists"

This is fine! The migration uses `IF NOT EXISTS`, so it's safe to run again.

### Error: "permission denied"

Your database user doesn't have permission to alter tables. Connect as a superuser or grant permissions:

```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
```

### Verify Migration Status

Check what's been applied:

```sql
-- Check all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check api_keys columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'api_keys' 
ORDER BY ordinal_position;
```

## Environment Setup

After running migrations, ensure your `.env` file has:

```env
# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Encryption key for API keys (required for reveal feature)
ENCRYPTION_KEY=your-secure-random-key-here
```

Generate a secure encryption key:

```bash
openssl rand -base64 32
```

## Migration History

| Date       | File                          | Description                    |
|------------|-------------------------------|--------------------------------|
| 2026-04-30 | add_key_encrypted_column.sql  | Add API key encryption support |
| 2026-04-30 | complete_schema_upgrade.sql   | Complete schema with all tables|

## Best Practices

1. **Backup First**: Always backup your database before running migrations
   ```bash
   pg_dump -U user -d dbname > backup_$(date +%Y%m%d).sql
   ```

2. **Test in Development**: Run migrations in a dev environment first

3. **Use Transactions**: Wrap migrations in transactions when possible
   ```sql
   BEGIN;
   -- your migration
   COMMIT;
   ```

4. **Verify After**: Always verify the migration succeeded

5. **Keep Backups**: Keep the encryption key backed up securely

## Rollback

To remove the key_encrypted column (not recommended):

```sql
ALTER TABLE api_keys DROP COLUMN IF EXISTS key_encrypted;
```

**Warning**: This will permanently delete all encrypted API key data!

## Support

If you encounter issues:

1. Check the server logs for detailed errors
2. Use the debug endpoint: `GET /api/v1/api-keys/debug`
3. Verify database connection
4. Check user permissions
5. Review the troubleshooting guide: `docs/TROUBLESHOOTING_500_ERROR.md`
